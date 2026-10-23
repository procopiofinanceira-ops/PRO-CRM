import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';
import { criarNotificacao } from '../lib/notificacoes.js';
import { resolverDonoId } from '../lib/permissoes.js';

// Acompanhamento dos clientes (oportunidades) que cada promotor está trabalhando.
// Master vê todas as equipes; supervisor, só a dele.

const router = Router();
router.use(autenticar, exigirPerfil('MASTER', 'SUPERVISOR'));

const SEM_CONVENIO = 'Sem convênio';
const MAX_LOTE = 2000;

const escopoOps = (req) => (req.usuario.perfil === 'MASTER' ? {} : { donoId: req.donoId });
const escopoPromotores = (req) =>
  req.usuario.perfil === 'MASTER' ? { perfil: 'PROMOTOR' } : { perfil: 'PROMOTOR', superiorId: req.donoId };

// Mês em que o cliente foi atualizado, no fuso de São Paulo ("AAAA-MM")
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const mesDe = (data) => formatoDia.format(new Date(data)).slice(0, 7);

const mesValido = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m ?? '')) ? String(m) : null);

async function buscarPromotor(req, res, next) {
  const promotor = await prisma.usuario.findFirst({
    where: { id: req.params.id, ...escopoPromotores(req) },
    select: { id: true, nome: true, email: true, ativo: true, superiorId: true },
  });
  if (!promotor) return res.status(404).json({ erro: 'Promotor não encontrado.' });
  req.promotor = promotor;
  next();
}

// ---------------- Visão geral ----------------
router.get('/resumo', async (req, res) => {
  const mes = mesValido(req.query.mes);

  const [ops, promotores] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { ...escopoOps(req), responsavelId: { not: null } },
      select: { responsavelId: true, empresa: true, estagio: true, atualizadoEm: true },
      take: 100_000,
    }),
    prisma.usuario.findMany({
      where: { ...escopoPromotores(req), ativo: true },
      select: { id: true, nome: true, email: true, superiorId: true },
      orderBy: { nome: 'asc' },
    }),
  ]);

  // Meses com clientes (para o filtro), do mais recente para o mais antigo
  const porMes = new Map();
  for (const op of ops) {
    const m = mesDe(op.atualizadoEm);
    porMes.set(m, (porMes.get(m) ?? 0) + 1);
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([m, total]) => ({ mes: m, total }));

  const filtradas = mes ? ops.filter((op) => mesDe(op.atualizadoEm) === mes) : ops;

  const conv = new Map();
  const stats = new Map();
  for (const op of filtradas) {
    const nome = op.empresa ?? SEM_CONVENIO;
    const c = conv.get(nome) ?? { convenio: nome, total: 0, porEstagio: {} };
    c.total += 1;
    c.porEstagio[op.estagio] = (c.porEstagio[op.estagio] ?? 0) + 1;
    conv.set(nome, c);

    const s = stats.get(op.responsavelId) ?? { total: 0, porEstagio: {} };
    s.total += 1;
    s.porEstagio[op.estagio] = (s.porEstagio[op.estagio] ?? 0) + 1;
    stats.set(op.responsavelId, s);
  }

  // Master vê de qual supervisor é cada promotor
  let nomeSupervisor = new Map();
  if (req.usuario.perfil === 'MASTER') {
    const ids = [...new Set(promotores.map((p) => p.superiorId).filter(Boolean))];
    const sups = ids.length ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }) : [];
    nomeSupervisor = new Map(sups.map((s) => [s.id, s.nome]));
  }

  res.json({
    meses,
    totalClientes: filtradas.length,
    convenios: [...conv.values()].sort((a, b) => a.convenio.localeCompare(b.convenio, 'pt-BR', { sensitivity: 'base' })),
    promotores: promotores.map((p) => ({
      ...p,
      supervisor: nomeSupervisor.get(p.superiorId) ?? null,
      total: stats.get(p.id)?.total ?? 0,
      porEstagio: stats.get(p.id)?.porEstagio ?? {},
    })),
  });
});

// ---------------- Clientes de um promotor ----------------
router.get('/:id/clientes', buscarPromotor, async (req, res) => {
  const { estagio, motivo, q } = req.query;
  const mes = mesValido(req.query.mes);
  const where = { ...escopoOps(req), responsavelId: req.promotor.id };
  if (estagio) where.estagio = String(estagio);
  if (motivo) where.motivoPerda = { contains: String(motivo) };
  const busca = String(q ?? '').trim();
  if (busca) where.OR = [{ nome: { contains: busca } }, { cpf: { contains: busca.replace(/\D/g, '') || busca } }, { empresa: { contains: busca } }];

  const itens = await prisma.oportunidade.findMany({
    where,
    orderBy: { atualizadoEm: 'desc' },
    take: 2000,
    select: {
      id: true, nome: true, cpf: true, telefone: true, empresa: true, estagio: true, valor: true,
      receitaEsperada: true, motivoPerda: true, prioridade: true, dataRetorno: true, atualizadoEm: true,
    },
  });
  const doMes = mes ? itens.filter((o) => mesDe(o.atualizadoEm) === mes) : itens;
  res.json({ promotor: req.promotor, itens: doMes, total: doMes.length });
});

// Passa clientes de um promotor para outro da mesma equipe
const transferirSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos um cliente.').max(MAX_LOTE),
  destinoId: z.string().uuid(),
});

router.post('/transferir', async (req, res) => {
  const dados = transferirSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const destino = await prisma.usuario.findFirst({
    where: { id: dados.data.destinoId, ativo: true, ...escopoPromotores(req) },
    select: { id: true, nome: true, perfil: true, superiorId: true },
  });
  if (!destino) return res.status(400).json({ erro: 'Promotor de destino não encontrado.' });

  // Os dados de cada equipe não se misturam: só vai para um promotor da mesma equipe do cliente
  const r = await prisma.oportunidade.updateMany({
    where: { id: { in: dados.data.ids }, ...escopoOps(req), donoId: resolverDonoId(destino) },
    data: { responsavelId: destino.id },
  });

  if (r.count) {
    criarNotificacao({
      donoId: resolverDonoId(destino),
      usuarioId: destino.id,
      tipo: 'clientes_transferidos',
      titulo: 'Você recebeu clientes',
      mensagem: `${r.count.toLocaleString('pt-BR')} cliente(s) foram transferidos para você.`,
    });
  }
  res.json({ transferidos: r.count, ignorados: dados.data.ids.length - r.count });
});

// Remove os clientes de um promotor (todos, ou só de um convênio)
router.delete('/:id/clientes', buscarPromotor, async (req, res) => {
  const where = { ...escopoOps(req), responsavelId: req.promotor.id };
  const convenio = String(req.query.convenio ?? '').trim();
  if (convenio) where.empresa = convenio === SEM_CONVENIO ? null : convenio;
  const r = await prisma.oportunidade.deleteMany({ where });
  res.json({ excluidos: r.count });
});

// ---------------- Perdidos (só master) ----------------
router.get('/perdidos/contagem', exigirPerfil('MASTER'), async (req, res) => {
  res.json({ total: await prisma.oportunidade.count({ where: { estagio: 'perdemos', responsavelId: { not: null } } }) });
});

// "Liberar" os perdidos: sai do funil dos promotores, para o cliente poder ser trabalhado de novo
router.post('/liberar-perdidos', exigirPerfil('MASTER'), async (req, res) => {
  const r = await prisma.oportunidade.deleteMany({ where: { estagio: 'perdemos', responsavelId: { not: null } } });
  res.json({ liberados: r.count });
});

export default router;
