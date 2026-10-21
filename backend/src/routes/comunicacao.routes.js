import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { criarCrud, txt, data, num } from '../lib/crud.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const inteiro = z.coerce.number().int().min(0).optional();
const pct = z.union([z.null(), z.literal(''), z.coerce.number().min(0).max(100)]).optional().transform((v) => (v === '' ? null : v));
const SITUACOES = ['RASCUNHO', 'EM_FILA', 'ENVIANDO', 'ENVIADO', 'CANCELADO'];

// ---------------- E-mail e SMS marketing ----------------
export const emailMarketing = criarCrud({
  model: 'emailMarketing',
  busca: ['assunto', 'responsavel', 'listaCorreio'],
  filtros: ['situacao'],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    assunto: z.string().trim().min(2, 'Informe o assunto.'),
    responsavel: txt,
    listaCorreio: txt,
    enviados: inteiro,
    entreguePct: pct,
    abertoPct: pct,
    clicadoPct: pct,
    respondidoPct: pct,
    situacao: z.enum(SITUACOES).optional(),
    dataEnvio: data,
  }),
});

export const smsMarketing = criarCrud({
  model: 'smsMarketing',
  busca: ['nome', 'listaCorreio'],
  filtros: ['situacao'],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    listaCorreio: txt,
    enviados: inteiro,
    entregues: inteiro,
    abertoPct: pct,
    respondidoPct: pct,
    clicadoPct: pct,
    situacao: z.enum(SITUACOES).optional(),
    dataInicio: data,
    dataFim: data,
  }),
});

// ---------------- Central de ajuda ----------------
export const timesAjuda = criarCrud({
  model: 'timeAjuda',
  busca: ['nome'],
  ordem: { nome: 'asc' },
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome do time.'),
    naoAtribuidos: inteiro,
    naoAtendidos: inteiro,
    prioridade: inteiro,
  }),
});

export const chamados = criarCrud({
  model: 'chamado',
  busca: ['titulo', 'descricao'],
  filtros: ['status', 'prioridade', 'timeId'],
  ordem: { criadoEm: 'desc' },
  incluir: { time: { select: { id: true, nome: true } } },
  schema: z.object({
    titulo: z.string().trim().min(2, 'Informe o título.'),
    descricao: txt,
    status: z.enum(['NOVO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO']).optional(),
    prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
    timeId: txt,
    atribuidoAId: txt,
  }),
});

// ---------------- Mensagens internas (canais) ----------------
export const canais = Router();
canais.use(autenticar);

const gerenciaCanais = exigirPerfil('MASTER', 'SUPERVISOR');

canais.get('/', async (req, res) => {
  // Todo time tem ao menos o canal "Geral"
  await prisma.canal.upsert({
    where: { donoId_nome: { donoId: req.donoId, nome: 'Geral' } },
    update: {},
    create: { donoId: req.donoId, nome: 'Geral', descricao: 'Conversa de toda a equipe' },
  });

  const itens = await prisma.canal.findMany({ where: { donoId: req.donoId }, orderBy: { nome: 'asc' } });
  const naoLidas = await prisma.mensagem.groupBy({
    by: ['canalId'],
    where: {
      canal: { donoId: req.donoId },
      lida: false,
      OR: [{ remetenteId: null }, { remetenteId: { not: req.usuario.id } }],
    },
    _count: { _all: true },
  });
  const contagem = new Map(naoLidas.map((n) => [n.canalId, n._count._all]));

  res.json({ itens: itens.map((c) => ({ ...c, naoLidas: contagem.get(c.id) ?? 0 })) });
});

const canalSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do canal.').max(60),
  descricao: z.string().trim().nullable().optional(),
});

canais.post('/', gerenciaCanais, async (req, res) => {
  const dados = canalSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  try {
    const item = await prisma.canal.create({ data: { ...dados.data, donoId: req.donoId } });
    res.status(201).json({ item });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ erro: 'Já existe um canal com esse nome.' });
    throw e;
  }
});

async function buscarCanal(req, res, next) {
  const canal = await prisma.canal.findFirst({ where: { id: req.params.id, donoId: req.donoId } });
  if (!canal) return res.status(404).json({ erro: 'Canal não encontrado.' });
  req.canal = canal;
  next();
}

canais.delete('/:id', gerenciaCanais, buscarCanal, async (req, res) => {
  if (req.canal.nome === 'Geral') return res.status(400).json({ erro: 'O canal Geral não pode ser excluído.' });
  await prisma.canal.delete({ where: { id: req.canal.id } });
  res.json({ ok: true });
});

canais.get('/:id/mensagens', buscarCanal, async (req, res) => {
  const itens = await prisma.mensagem.findMany({
    where: { canalId: req.canal.id },
    orderBy: { criadoEm: 'desc' },
    take: 200,
    include: { remetente: { select: { id: true, nome: true } } },
  });
  res.json({ itens: itens.reverse() });
});

canais.post('/:id/mensagens', buscarCanal, async (req, res) => {
  const dados = z
    .object({
      conteudo: z.string().trim().min(1, 'Escreva uma mensagem.').max(4000),
      prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
    })
    .safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const item = await prisma.mensagem.create({
    data: { ...dados.data, canalId: req.canal.id, remetenteId: req.usuario.id, lida: false },
    include: { remetente: { select: { id: true, nome: true } } },
  });
  res.status(201).json({ item });
});

/** Marca como lidas as mensagens do canal enviadas por outras pessoas. */
canais.post('/:id/ler', buscarCanal, async (req, res) => {
  await prisma.mensagem.updateMany({
    where: {
      canalId: req.canal.id,
      lida: false,
      OR: [{ remetenteId: null }, { remetenteId: { not: req.usuario.id } }],
    },
    data: { lida: true },
  });
  res.json({ ok: true });
});
