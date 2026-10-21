import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';
import { distribuirLeads } from './importacoes.routes.js';

// Campanhas de supervisor: agrupam leads da base por convênio para serem
// trabalhados (e distribuídos aos promotores) como uma ação única.

export const campanhas = Router();
campanhas.use(autenticar, exigirPerfil('MASTER', 'SUPERVISOR'));

const campanhaSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da campanha.'),
  convenios: z.array(z.string().trim().min(1)).min(1, 'Escolha ao menos um convênio.'),
});

const incluirContagem = { _count: { select: { clientes: true } } };

campanhas.get('/', async (req, res) => {
  const itens = await prisma.campanhaSupervisor.findMany({
    where: { donoId: req.donoId },
    orderBy: { criadoEm: 'desc' },
    include: incluirContagem,
  });
  res.json({ itens });
});

campanhas.post('/', async (req, res) => {
  const dados = campanhaSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const item = await prisma.campanhaSupervisor.create({
    data: { ...dados.data, donoId: req.donoId },
    include: incluirContagem,
  });
  res.status(201).json({ item });
});

async function buscarCampanha(req, res, next) {
  const campanha = await prisma.campanhaSupervisor.findFirst({
    where: { id: req.params.id, donoId: req.donoId },
  });
  if (!campanha) return res.status(404).json({ erro: 'Campanha não encontrada.' });
  req.campanha = campanha;
  next();
}

campanhas.put('/:id', buscarCampanha, async (req, res) => {
  const dados = campanhaSchema.partial().safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const item = await prisma.campanhaSupervisor.update({
    where: { id: req.campanha.id },
    data: dados.data,
    include: incluirContagem,
  });
  res.json({ item });
});

campanhas.delete('/:id', buscarCampanha, async (req, res) => {
  await prisma.campanhaSupervisor.delete({ where: { id: req.campanha.id } });
  res.json({ ok: true });
});

/** Leads que fazem parte da campanha (com situação e responsável). */
campanhas.get('/:id/leads', buscarCampanha, async (req, res) => {
  const pagina = Math.max(Number(req.query.pagina) || 1, 1);
  const limite = Math.min(Number(req.query.limite) || 50, 200);

  const [total, clientes] = await Promise.all([
    prisma.campanhaSupervisorCliente.count({ where: { campanhaId: req.campanha.id } }),
    prisma.campanhaSupervisorCliente.findMany({
      where: { campanhaId: req.campanha.id },
      select: { leadId: true },
      skip: (pagina - 1) * limite,
      take: limite,
    }),
  ]);

  const itens = await prisma.leadImportado.findMany({
    where: { id: { in: clientes.map((c) => c.leadId).filter(Boolean) }, donoId: req.donoId },
  });
  res.json({ itens, total, pagina, limite });
});

/** Puxa para a campanha leads da base dos convênios escolhidos (sem repetir). */
campanhas.post('/:id/adicionar', buscarCampanha, async (req, res) => {
  const dados = z.object({ quantidade: z.coerce.number().int().min(1).optional() }).safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Quantidade inválida.' });

  const jaNaCampanha = await prisma.campanhaSupervisorCliente.findMany({
    where: { campanhaId: req.campanha.id },
    select: { leadId: true },
  });
  const excluir = jaNaCampanha.map((c) => c.leadId).filter(Boolean);

  const novos = await prisma.leadImportado.findMany({
    where: {
      donoId: req.donoId,
      convenio: { in: req.campanha.convenios },
      funcionarioId: null,
      ...(excluir.length && { id: { notIn: excluir } }),
    },
    select: { id: true, convenio: true, cpf: true, matricula: true },
    orderBy: { criadoEm: 'asc' },
    ...(dados.data.quantidade && { take: dados.data.quantidade }),
  });

  if (novos.length) {
    await prisma.campanhaSupervisorCliente.createMany({
      data: novos.map((l) => ({
        donoId: req.donoId,
        campanhaId: req.campanha.id,
        leadId: l.id,
        convenio: l.convenio ?? '',
        cpf: l.cpf,
        matricula: l.matricula,
      })),
    });
  }
  res.json({ adicionados: novos.length });
});

/** Distribui, em rodízio, os leads da campanha que ainda estão sem responsável. */
campanhas.post('/:id/distribuir', buscarCampanha, async (req, res) => {
  const dados = z
    .object({
      usuarioIds: z.array(z.string().uuid()).min(1, 'Escolha ao menos um promotor.'),
      quantidade: z.coerce.number().int().min(1).optional(),
    })
    .safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const clientes = await prisma.campanhaSupervisorCliente.findMany({
    where: { campanhaId: req.campanha.id },
    select: { leadId: true },
  });
  const ids = clientes.map((c) => c.leadId).filter(Boolean);

  try {
    res.json(
      await distribuirLeads({
        donoId: req.donoId,
        usuarioIds: dados.data.usuarioIds,
        quantidade: dados.data.quantidade,
        filtroLeads: { id: { in: ids } },
      }),
    );
  } catch (e) {
    res.status(e.status ?? 500).json({ erro: e.status ? e.message : 'Erro ao distribuir.' });
  }
});

// ---------------- Filtros favoritos dos leads ----------------

export const favoritos = Router();
favoritos.use(autenticar);

const favoritoSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao filtro.').max(80),
  tipo: z.string().trim().default('gestao'),
  filtros: z.record(z.any()),
});

favoritos.get('/', async (req, res) => {
  const itens = await prisma.leadFavorito.findMany({
    where: { donoId: req.donoId, usuarioId: req.usuario.id },
    orderBy: { criadoEm: 'desc' },
  });
  res.json({ itens });
});

favoritos.post('/', async (req, res) => {
  const dados = favoritoSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const item = await prisma.leadFavorito.create({
    data: { ...dados.data, donoId: req.donoId, usuarioId: req.usuario.id },
  });
  res.status(201).json({ item });
});

favoritos.delete('/:id', async (req, res) => {
  const r = await prisma.leadFavorito.deleteMany({
    where: { id: req.params.id, donoId: req.donoId, usuarioId: req.usuario.id },
  });
  if (!r.count) return res.status(404).json({ erro: 'Filtro não encontrado.' });
  res.json({ ok: true });
});
