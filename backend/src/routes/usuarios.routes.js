import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { perfisGerenciaveis, USUARIO_PUBLICO } from '../lib/permissoes.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
router.use(autenticar, exigirPerfil('MASTER', 'SUPERVISOR'));

const PERFIS = ['MASTER', 'GERENTE', 'SUPERVISOR', 'BKO', 'PROMOTOR'];

const criarSchema = z.object({
  perfil: z.enum(PERFIS),
  nome: z.string().min(2),
  email: z.string().email().toLowerCase(),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
  cargo: z.string().optional(),
  departamento: z.string().optional(),
  telefone: z.string().optional(),
  superiorId: z.string().uuid().optional(),
  permissoes: z.array(z.string()).optional(),
  permissaoEstrategia: z.boolean().optional(),
  permissaoImportacao: z.boolean().optional(),
  // Só o master define quais supervisores um gerente/BKO acompanha
  supervisoresGerenciados: z.array(z.string().uuid()).optional(),
});

const atualizarSchema = criarSchema
  .omit({ perfil: true, email: true, superiorId: true })
  .partial()
  .extend({ ativo: z.boolean().optional() });

/** Escopo do que o usuário logado enxerga e gerencia. */
function escopo(usuario) {
  if (usuario.perfil === 'MASTER') return {};
  return { superiorId: usuario.id, perfil: { in: perfisGerenciaveis(usuario.perfil) } };
}

router.get('/', async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    where: escopo(req.usuario),
    select: USUARIO_PUBLICO,
    orderBy: { nome: 'asc' },
  });
  res.json({ usuarios });
});

router.post('/', async (req, res) => {
  const dados = criarSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const { senha, ...resto } = dados.data;
  if (req.usuario.perfil !== 'MASTER') delete resto.supervisoresGerenciados;

  if (!perfisGerenciaveis(req.usuario.perfil).includes(resto.perfil)) {
    return res.status(403).json({ erro: 'Você não pode criar este perfil.' });
  }

  // Supervisor só cria subordinados diretos; o master escolhe (ou fica sem superior).
  const superiorId = req.usuario.perfil === 'MASTER' ? resto.superiorId : req.usuario.id;

  if (['BKO', 'PROMOTOR'].includes(resto.perfil) && !superiorId) {
    return res.status(400).json({ erro: 'Informe o supervisor responsável (superiorId).' });
  }
  if (superiorId) {
    const superior = await prisma.usuario.findUnique({ where: { id: superiorId } });
    if (!superior) return res.status(400).json({ erro: 'Supervisor não encontrado.' });
  }

  const existe = await prisma.usuario.findUnique({ where: { email: resto.email } });
  if (existe) return res.status(409).json({ erro: 'Já existe usuário com este e-mail.' });

  const usuario = await prisma.usuario.create({
    data: { ...resto, superiorId, senhaHash: await bcrypt.hash(senha, 12) },
    select: USUARIO_PUBLICO,
  });
  res.status(201).json({ usuario });
});

router.put('/:id', async (req, res) => {
  const dados = atualizarSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const alvo = await prisma.usuario.findFirst({ where: { id: req.params.id, ...escopo(req.usuario) } });
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  const { senha, ...resto } = dados.data;
  if (req.usuario.perfil !== 'MASTER') delete resto.supervisoresGerenciados;
  const usuario = await prisma.usuario.update({
    where: { id: alvo.id },
    data: { ...resto, ...(senha && { senhaHash: await bcrypt.hash(senha, 12) }) },
    select: USUARIO_PUBLICO,
  });
  res.json({ usuario });
});

// Desativa em vez de apagar, para preservar o histórico dos registros
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode desativar a si mesmo.' });
  }
  const alvo = await prisma.usuario.findFirst({ where: { id: req.params.id, ...escopo(req.usuario) } });
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  await prisma.usuario.update({ where: { id: alvo.id }, data: { ativo: false } });
  res.json({ ok: true });
});

export default router;
