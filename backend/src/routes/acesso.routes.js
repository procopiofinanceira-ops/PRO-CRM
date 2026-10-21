import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';
import {
  controleDesligado,
  definirTravaPrimeiroLogin,
  ipDoCliente,
  ipPermitido,
  ipValido,
  lerControle,
  normalizarIp,
  salvarIps,
} from '../lib/controleAcesso.js';

const router = Router();
router.use(autenticar);

const MAX_IPS = 20;

// IP que o servidor enxerga para esta conexão (ajuda a liberar o IP certo)
router.get('/meu-ip', (req, res) => res.json({ ip: ipDoCliente(req) }));

router.use(exigirPerfil('MASTER'));

async function buscarMaster(req, res, next) {
  const alvo = await prisma.usuario.findFirst({ where: { id: req.params.id, perfil: 'MASTER' }, select: { id: true } });
  if (!alvo) return res.status(404).json({ erro: 'Master não encontrado.' });
  req.alvo = alvo;
  next();
}

router.get('/:id', buscarMaster, async (req, res) => {
  const c = await lerControle(req.alvo.id);
  res.json({
    ips: c.ips,
    ultimoIp: c.ultimoIp,
    ultimoAcessoEm: c.ultimoAcessoEm,
    ipBloqueado: c.ipBloqueado,
    ipBloqueadoEm: c.ipBloqueadoEm,
    travarPrimeiroLogin: c.travarPrimeiroLogin,
    ipAtual: ipDoCliente(req),
    travaDesligada: controleDesligado(),
  });
});

const salvarSchema = z.object({
  ips: z.array(z.string()),
  travarPrimeiroLogin: z.boolean().optional(),
});

router.put('/:id', buscarMaster, async (req, res) => {
  const dados = salvarSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Informe a lista de IPs.' });

  const ips = [...new Set(dados.data.ips.map(normalizarIp).filter(Boolean))];
  const invalidos = ips.filter((ip) => !ipValido(ip));
  if (invalidos.length) return res.status(400).json({ erro: `IP inválido: ${invalidos.join(', ')}` });
  if (ips.length > MAX_IPS) return res.status(400).json({ erro: `Informe no máximo ${MAX_IPS} IPs.` });

  // Evita trancar a própria conta: editando a si mesmo, o IP atual precisa estar na lista
  const ipAtual = ipDoCliente(req);
  if (req.alvo.id === req.usuario.id && ips.length > 0 && !ipPermitido(ipAtual, ips)) {
    return res.status(400).json({ erro: `Seu IP atual (${ipAtual}) não está na lista. Adicione-o para não perder o acesso.` });
  }

  await salvarIps(req.alvo.id, ips);
  // "Travar no primeiro login" só faz sentido com a lista vazia
  await definirTravaPrimeiroLogin(req.alvo.id, ips.length === 0 && dados.data.travarPrimeiroLogin === true);
  res.json({ ok: true, ips });
});

export default router;
