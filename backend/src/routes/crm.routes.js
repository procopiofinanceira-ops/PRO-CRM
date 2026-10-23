import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { criarCrud, txt, data, num } from '../lib/crud.js';
import { autenticar } from '../middleware/auth.js';
import { ESTAGIOS_ROTULO, garantirNaCarteira, prepararAtualizacao, prepararCriacao } from '../lib/oportunidadeRegras.js';

// ---------------- Contatos ----------------
export const contatos = criarCrud({
  model: 'contato',
  busca: ['nome', 'empresa', 'email', 'telefone'],
  ordem: { nome: 'asc' },
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    empresa: txt,
    pais: txt,
    telefone: txt,
    email: txt,
    tipo: z.enum(['PESSOA', 'EMPRESA']).optional(),
    favorito: z.boolean().optional(),
    fotoUrl: txt,
    observacoes: txt,
  }),
});

// ---------------- Oportunidades (kanban) ----------------
export const oportunidades = criarCrud({
  model: 'oportunidade',
  busca: ['nome', 'empresa', 'cpf', 'telefone'],
  filtros: ['estagio'],
  ordem: { atualizadoEm: 'desc' },
  incluir: { contato: { select: { id: true, nome: true } } },
  // Promotor enxerga apenas as oportunidades que ele mesmo atende
  escopoExtra: (req) => (req.usuario.perfil === 'PROMOTOR' ? { responsavelId: req.usuario.id } : {}),
  aoCriar: prepararCriacao,
  aoAtualizar: prepararAtualizacao,
  aposSalvar: (req, op) => garantirNaCarteira(req.donoId, op),
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    contatoId: txt,
    responsavelId: txt,
    empresa: txt,
    valor: num,
    estagio: z.enum(Object.keys(ESTAGIOS_ROTULO)).optional(),
    pipeline: z.string().trim().min(1).optional(),
    dataPrevista: data,
    prioridade: z.coerce.number().int().min(0).max(3).optional(),
    descricao: txt,
    telefone: txt,
    email: txt,
    produto: txt,
    cidade: txt,
    cpf: txt,
    motivoPerda: txt,
    receitaEsperada: num,
    dataRetorno: data,
    horaRetorno: z
      .union([z.null(), z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (use HH:MM).')])
      .optional()
      .transform((v) => (v === '' ? null : v)),
    // Anotação interna nova: vai para o histórico e não é guardada como campo
    notaInterna: z.string().trim().max(2000).optional(),
    detalhes: z.record(z.any()).nullable().optional(),
  }),
});

// ---------------- Produtos ----------------
export const produtos = criarCrud({
  model: 'produto',
  busca: ['nome', 'origem', 'telefone'],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    origem: txt,
    ddd: txt,
    telefone: txt,
    qtdOutrosProdutos: z.coerce.number().int().nullable().optional(),
    outrosProdutos: txt,
  }),
});

// ---------------- Observações ----------------
export const observacoes = criarCrud({
  model: 'observacao',
  busca: ['titulo', 'conteudo'],
  ordem: { atualizadoEm: 'desc' },
  schema: z.object({
    titulo: z.string().trim().min(1, 'Informe o título.'),
    conteudo: txt,
    estagio: z.enum(['NOVA', 'ATA_REUNIAO', 'ANOTACAO', 'A_FAZER']).optional(),
  }),
});

// ---------------- Calendário ----------------
export const eventos = criarCrud({
  model: 'eventoCalendario',
  busca: ['titulo', 'local'],
  ordem: { dataInicio: 'asc' },
  schema: z.object({
    titulo: z.string().trim().min(1, 'Informe o título.'),
    descricao: txt,
    dataInicio: z.coerce.date(),
    dataFim: z.coerce.date(),
    diaInteiro: z.boolean().optional(),
    cor: z.string().trim().optional(),
    local: txt,
    participante: txt,
  }),
});

// ---------------- Projetos e tarefas ----------------
export const projetos = criarCrud({
  model: 'projeto',
  busca: ['nome', 'responsavel', 'categoria'],
  ordem: { criadoEm: 'desc' },
  incluir: { tarefas: { orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }] } },
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    responsavel: txt,
    dataInicio: data,
    dataFim: data,
    equipe: txt,
    descricao: txt,
    status: z.enum(['EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO', 'CANCELADO']).optional(),
    progresso: z.coerce.number().int().min(0).max(100).optional(),
    prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
    categoria: txt,
    favorito: z.boolean().optional(),
  }),
});

const tarefaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título.'),
  descricao: txt,
  status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA']).optional(),
  responsavel: txt,
  dataLimite: data,
  ordem: z.coerce.number().int().optional(),
});

async function recalcularProgresso(projetoId) {
  const tarefas = await prisma.tarefa.findMany({ where: { projetoId }, select: { status: true } });
  if (!tarefas.length) return;
  const feitas = tarefas.filter((t) => t.status === 'CONCLUIDA').length;
  await prisma.projeto.update({
    where: { id: projetoId },
    data: { progresso: Math.round((feitas / tarefas.length) * 100) },
  });
}

export const tarefas = Router({ mergeParams: true });
tarefas.use(autenticar);

tarefas.use(async (req, res, next) => {
  const projeto = await prisma.projeto.findFirst({
    where: { id: req.params.projetoId, donoId: req.donoId },
  });
  if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado.' });
  req.projeto = projeto;
  next();
});

tarefas.post('/', async (req, res) => {
  const dados = tarefaSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const item = await prisma.tarefa.create({ data: { ...dados.data, projetoId: req.projeto.id } });
  await recalcularProgresso(req.projeto.id);
  res.status(201).json({ item });
});

tarefas.put('/:tarefaId', async (req, res) => {
  const dados = tarefaSchema.partial().safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const atual = await prisma.tarefa.findFirst({ where: { id: req.params.tarefaId, projetoId: req.projeto.id } });
  if (!atual) return res.status(404).json({ erro: 'Tarefa não encontrada.' });

  const item = await prisma.tarefa.update({ where: { id: atual.id }, data: dados.data });
  await recalcularProgresso(req.projeto.id);
  res.json({ item });
});

tarefas.delete('/:tarefaId', async (req, res) => {
  const atual = await prisma.tarefa.findFirst({ where: { id: req.params.tarefaId, projetoId: req.projeto.id } });
  if (!atual) return res.status(404).json({ erro: 'Tarefa não encontrada.' });

  await prisma.tarefa.delete({ where: { id: atual.id } });
  await recalcularProgresso(req.projeto.id);
  res.json({ ok: true });
});

// ---------------- Dashboard ----------------
export const dashboard = Router();
dashboard.use(autenticar);

dashboard.get('/', async (req, res) => {
  const donoId = req.donoId;
  const filtroOp = { donoId, ...(req.usuario.perfil === 'PROMOTOR' && { responsavelId: req.usuario.id }) };

  const [totalContatos, porEstagio, projetosAtivos, proximosEventos] = await Promise.all([
    prisma.contato.count({ where: { donoId } }),
    prisma.oportunidade.groupBy({
      by: ['estagio'],
      where: filtroOp,
      _count: { _all: true },
      _sum: { valor: true },
    }),
    prisma.projeto.count({ where: { donoId, status: 'EM_ANDAMENTO' } }),
    prisma.eventoCalendario.findMany({
      where: { donoId, dataFim: { gte: new Date() } },
      orderBy: { dataInicio: 'asc' },
      take: 5,
    }),
  ]);

  // Série dos últimos 14 dias (para os gráficos do painel)
  const dias = 14;
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - (dias - 1));
  const promotor = req.usuario.perfil === 'PROMOTOR';
  // Agrupa pelo dia local do servidor (o banco guarda em UTC)
  const deslocamento = -inicio.getTimezoneOffset();
  const [opPorDia, leadsPorDia] = await Promise.all([
    promotor
      ? prisma.$queryRaw`SELECT DATE(DATE_ADD(criado_em, INTERVAL ${deslocamento} MINUTE)) AS d, COUNT(*) AS n FROM oportunidades WHERE dono_id = ${donoId} AND responsavel_id = ${req.usuario.id} AND criado_em >= ${inicio} GROUP BY d`
      : prisma.$queryRaw`SELECT DATE(DATE_ADD(criado_em, INTERVAL ${deslocamento} MINUTE)) AS d, COUNT(*) AS n FROM oportunidades WHERE dono_id = ${donoId} AND criado_em >= ${inicio} GROUP BY d`,
    promotor
      ? prisma.$queryRaw`SELECT DATE(DATE_ADD(atualizado_em, INTERVAL ${deslocamento} MINUTE)) AS d, COUNT(*) AS n FROM leads_importados WHERE dono_id = ${donoId} AND funcionario_id = ${req.usuario.id} AND status_lead <> 'novo' AND atualizado_em >= ${inicio} GROUP BY d`
      : prisma.$queryRaw`SELECT DATE(DATE_ADD(atualizado_em, INTERVAL ${deslocamento} MINUTE)) AS d, COUNT(*) AS n FROM leads_importados WHERE dono_id = ${donoId} AND status_lead <> 'novo' AND atualizado_em >= ${inicio} GROUP BY d`,
  ]);
  const montarSerie = (linhas) => {
    const porDia = new Map(linhas.map((l) => [new Date(l.d).toISOString().slice(0, 10), Number(l.n)]));
    return Array.from({ length: dias }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { dia: chave, valor: porDia.get(chave) ?? 0 };
    });
  };

  // Retornos agendados para hoje ou atrasados (oportunidades ainda abertas)
  const fimDeHoje = new Date();
  fimDeHoje.setHours(23, 59, 59, 999);
  const filtroRetorno = {
    ...filtroOp,
    dataRetorno: { not: null, lte: fimDeHoje },
    estagio: { notIn: ['ganhamos', 'perdemos'] },
  };
  const [retornosTotal, retornosItens] = await Promise.all([
    prisma.oportunidade.count({ where: filtroRetorno }),
    prisma.oportunidade.findMany({
      where: filtroRetorno,
      orderBy: [{ dataRetorno: 'asc' }, { horaRetorno: 'asc' }],
      take: 6,
      select: { id: true, nome: true, empresa: true, dataRetorno: true, horaRetorno: true },
    }),
  ]);

  res.json({
    retornos: { total: retornosTotal, itens: retornosItens },
    serie: {
      oportunidadesCriadas: montarSerie(opPorDia),
      leadsTrabalhados: montarSerie(leadsPorDia),
    },
    totalContatos,
    projetosAtivos,
    proximosEventos,
    oportunidades: porEstagio.map((e) => ({
      estagio: e.estagio,
      quantidade: e._count._all,
      valor: Number(e._sum.valor ?? 0),
    })),
  });
});
