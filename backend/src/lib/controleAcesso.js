import crypto from 'node:crypto';
import { prisma } from './prisma.js';

// Controle de acesso: sessão única (um login novo derruba o anterior) e IPs liberados.
// Por enquanto vale só para o MASTER; os demais perfis não são consultados nem bloqueados.
// Lista de IPs vazia = sem restrição de IP. Falhas internas nunca bloqueiam ninguém.
// Emergência: CONTROLE_ACESSO_DESLIGADO=true no .env desliga todas as travas.
export const PERFIS_COM_TRAVA = new Set(['MASTER']);

export const controleDesligado = () =>
  String(process.env.CONTROLE_ACESSO_DESLIGADO ?? '').trim().toLowerCase() === 'true';

export const temTrava = (usuario) => PERFIS_COM_TRAVA.has(usuario?.perfil);

export function normalizarIp(ip) {
  const s = String(ip ?? '').trim().toLowerCase();
  return s.startsWith('::ffff:') ? s.slice(7) : s;
}

/** IP do cliente. Atrás de proxy (nginx) só é confiável com TRUST_PROXY configurado. */
export const ipDoCliente = (req) => normalizarIp(req?.ip || req?.socket?.remoteAddress || '');

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export function ipValido(ip) {
  const s = normalizarIp(ip);
  if (IPV4.test(s)) return true;
  return s.includes(':') && s.length <= 39 && /^[0-9a-f:]+$/.test(s) && s.split('::').length <= 2;
}

export function ipPermitido(ip, lista) {
  if (!Array.isArray(lista) || lista.length === 0) return true;
  const alvo = normalizarIp(ip);
  return lista.some((p) => normalizarIp(p) === alvo);
}

const vazio = {
  sessaoId: null,
  ips: [],
  ultimoIp: null,
  ultimoAcessoEm: null,
  ipBloqueado: null,
  ipBloqueadoEm: null,
  travarPrimeiroLogin: false,
};

export async function lerControle(usuarioId) {
  const linha = await prisma.controleAcesso.findUnique({ where: { usuarioId } });
  return linha ? { ...linha, ips: Array.isArray(linha.ips) ? linha.ips : [] } : { usuarioId, ...vazio };
}

const gravar = (usuarioId, dados) =>
  prisma.controleAcesso.upsert({ where: { usuarioId }, update: dados, create: { usuarioId, ...dados } });

export const salvarIps = (usuarioId, ips) => gravar(usuarioId, { ips });
export const definirTravaPrimeiroLogin = (usuarioId, valor) =>
  gravar(usuarioId, { travarPrimeiroLogin: valor === true });
const registrarIpBloqueado = (usuarioId, ip) =>
  gravar(usuarioId, { ipBloqueado: ip, ipBloqueadoEm: new Date() }).catch(() => {});

/**
 * No login: confere o IP e abre uma sessão nova (derrubando a anterior).
 * Retorna {} (sem trava), { sid } ou { bloqueio: { status, codigo, erro } }.
 */
export async function travaNoLogin(usuario, req) {
  if (!temTrava(usuario) || controleDesligado()) return {};
  try {
    const ip = ipDoCliente(req);
    let ctl = await lerControle(usuario.id);

    // "Travar no IP do primeiro login": só vale se marcado e ainda sem IPs
    if (ctl.travarPrimeiroLogin && ctl.ips.length === 0 && ipValido(ip)) {
      const r = await prisma.controleAcesso.updateMany({
        where: { usuarioId: usuario.id, travarPrimeiroLogin: true },
        data: { ips: [ip], travarPrimeiroLogin: false },
      });
      if (r.count) ctl = await lerControle(usuario.id);
    }

    if (!ipPermitido(ip, ctl.ips)) {
      await registrarIpBloqueado(usuario.id, ip);
      return {
        bloqueio: {
          status: 403,
          codigo: 'IP_NAO_PERMITIDO',
          erro: `Acesso não permitido deste local (IP ${ip}). Peça para liberar este IP.`,
        },
      };
    }

    const sid = crypto.randomUUID();
    await gravar(usuario.id, { sessaoId: sid, ultimoIp: ip, ultimoAcessoEm: new Date() });
    return { sid };
  } catch (e) {
    console.error('[ControleAcesso] falha no login, acesso liberado sem trava:', e.message);
    return {};
  }
}

/**
 * A cada requisição. `dono` é o usuário cuja sessão vale (o próprio, ou quem está
 * acessando o ambiente de outro). Retorna null (segue) ou { status, codigo, erro }.
 */
export async function verificarAcesso(req, dono, sid) {
  if (!temTrava(dono) || controleDesligado()) return null;
  try {
    const ctl = await lerControle(dono.id);
    // Tokens emitidos antes da trava (sem sid) valem até expirar
    if (sid && ctl.sessaoId && sid !== ctl.sessaoId) {
      return { status: 401, codigo: 'SESSAO_ENCERRADA', erro: 'Sua conta foi acessada em outro computador. Faça login novamente.' };
    }
    const ip = ipDoCliente(req);
    if (!ipPermitido(ip, ctl.ips)) {
      await registrarIpBloqueado(dono.id, ip);
      return { status: 401, codigo: 'IP_NAO_PERMITIDO', erro: `Acesso não permitido deste local (IP ${ip}).` };
    }
    return null;
  } catch (e) {
    console.error('[ControleAcesso] falha na verificação, acesso liberado:', e.message);
    return null;
  }
}
