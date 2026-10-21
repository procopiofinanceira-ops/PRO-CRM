import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();
router.use(autenticar);

/**
 * O que cada pessoa vê: promotor, só o que foi endereçado a ele; os demais perfis,
 * também os avisos da equipe (usuarioId nulo).
 */
const visiveis = (req) => ({
  donoId: req.donoId,
  ...(req.usuario.perfil === 'PROMOTOR'
    ? { usuarioId: req.usuario.id }
    : { OR: [{ usuarioId: null }, { usuarioId: req.usuario.id }] }),
});

// Quem acessa o ambiente de outro usuário pode ler, mas não marcar como lido (não mexe no estado dele)
function naoImpersonando(req, res, next) {
  if (req.impersonadoPor) {
    return res.status(403).json({ erro: 'Não é possível alterar notificações ao acessar o ambiente de outro usuário.' });
  }
  next();
}

router.get('/', async (req, res) => {
  const [itens, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({ where: visiveis(req), orderBy: { criadoEm: 'desc' }, take: 50 }),
    prisma.notificacao.count({ where: { ...visiveis(req), lida: false } }),
  ]);
  res.json({ itens, naoLidas });
});

router.post('/ler-todas', naoImpersonando, async (req, res) => {
  const r = await prisma.notificacao.updateMany({ where: { ...visiveis(req), lida: false }, data: { lida: true } });
  res.json({ marcadas: r.count });
});

router.post('/:id/ler', naoImpersonando, async (req, res) => {
  const r = await prisma.notificacao.updateMany({ where: { id: req.params.id, ...visiveis(req) }, data: { lida: true } });
  if (!r.count) return res.status(404).json({ erro: 'Notificação não encontrada.' });
  res.json({ ok: true });
});

router.delete('/:id', naoImpersonando, async (req, res) => {
  const r = await prisma.notificacao.deleteMany({ where: { id: req.params.id, ...visiveis(req) } });
  if (!r.count) return res.status(404).json({ erro: 'Notificação não encontrada.' });
  res.json({ ok: true });
});

export default router;
