import { prisma } from '../lib/prisma.js';
import { verificarToken } from '../lib/tokens.js';
import { podeEntrarComo, resolverDonoId } from '../lib/permissoes.js';
import { verificarAcesso } from '../lib/controleAcesso.js';

/** Exige token válido e usuário ativo. Preenche req.usuario e req.donoId. */
export async function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }

  try {
    const { sub, via, sid, vsid } = verificarToken(token);
    const usuario = await prisma.usuario.findUnique({ where: { id: sub } });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Sessão inválida.' });
    }

    // Acesso em nome de outro usuário: revalida a cada requisição se o ator ainda pode
    if (via) {
      const ator = await prisma.usuario.findUnique({ where: { id: via } });
      if (!ator || !ator.ativo || !podeEntrarComo(ator, usuario)) {
        return res.status(401).json({ erro: 'Sessão inválida.' });
      }
      req.impersonadoPor = { id: ator.id, nome: ator.nome, perfil: ator.perfil };
    }

    // Sessão única e IPs liberados: valem para o master, também quando ele acessa o ambiente de outro
    const bloqueio = await verificarAcesso(req, via ? req.impersonadoPor : usuario, via ? vsid : sid);
    if (bloqueio) return res.status(bloqueio.status).json({ erro: bloqueio.erro, codigo: bloqueio.codigo });

    req.sid = sid;

    req.usuario = usuario;
    req.donoId = resolverDonoId(usuario);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/** Restringe a rota aos perfis informados. Use depois de `autenticar`. */
export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Sem permissão para esta ação.' });
    }
    next();
  };
}
