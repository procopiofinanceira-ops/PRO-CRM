import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { autenticar } from '../middleware/auth.js';
import { criarNotificacao } from '../lib/notificacoes.js';
import { paraNumero } from '../lib/margem.js';
import { garantirNaCarteira, reservasPorCpf, veNomeDeQuemPegou } from '../lib/oportunidadeRegras.js';
import { escopoLeitura } from '../lib/escopoBases.js';

// ============================================================
// Importações (bases) — quem importa: master ou usuário com permissão
// ============================================================

function podeImportar(req, res, next) {
  const u = req.usuario;
  if (u.perfil === 'MASTER' || (u.perfil !== 'PROMOTOR' && u.permissaoImportacao)) return next();
  res.status(403).json({ erro: 'Você não tem permissão para importar bases.' });
}

export const importacoes = Router();
importacoes.use(autenticar, podeImportar);

importacoes.get('/', async (req, res) => {
  const itens = await prisma.importacaoPlanilha.findMany({
    where: { donoId: req.donoId },
    orderBy: { criadoEm: 'desc' },
    take: 200,
  });
  res.json({ itens });
});

const criarSchema = z.object({
  arquivo: z.string().trim().min(1),
  convenio: z.string().trim().min(1, 'Informe o convênio.'),
  codConvenio: z.string().trim().optional(),
  origem: z.string().trim().optional(),
});

importacoes.post('/', async (req, res) => {
  const dados = criarSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const item = await prisma.importacaoPlanilha.create({
    data: { ...dados.data, donoId: req.donoId, criadorId: req.usuario.id },
  });
  res.status(201).json({ item });
});

// Campos que viram colunas do lead; o restante vai para `dados` (JSON)
const apenasDigitos = (v) => String(v ?? '').replace(/\D/g, '') || null;
const limpo = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

function normalizarRegistro(r, importacao) {
  const { nome, cpf, celular1, matricula, emp_livre, ...resto } = r;
  const dados = Object.fromEntries(
    Object.entries(resto).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== ''),
  );
  return {
    cpf: apenasDigitos(cpf),
    nome: limpo(nome),
    telefone: apenasDigitos(celular1),
    matricula: limpo(matricula),
    margem: limpo(emp_livre),
    margemValor: paraNumero(emp_livre),
    dados: Object.keys(dados).length ? dados : undefined,
    convenio: importacao.convenio,
    codConvenio: importacao.codConvenio,
    origem: importacao.origem,
    donoId: importacao.donoId,
    importacaoId: importacao.id,
  };
}

const registrosSchema = z.object({
  registros: z
    .array(z.record(z.union([z.string(), z.number(), z.null()])))
    .min(1)
    .max(1000),
});

importacoes.post('/:id/registros', async (req, res) => {
  const dados = registrosSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Registros inválidos.' });

  const importacao = await prisma.importacaoPlanilha.findFirst({
    where: { id: req.params.id, donoId: req.donoId },
  });
  if (!importacao) return res.status(404).json({ erro: 'Importação não encontrada.' });

  const normalizados = dados.data.registros.map((r) => normalizarRegistro(r, importacao));

  // Duplicados: mesmo CPF no mesmo convênio (já na base ou repetido no lote)
  const cpfs = [...new Set(normalizados.map((r) => r.cpf).filter(Boolean))];
  const existentes = cpfs.length
    ? await prisma.leadImportado.findMany({
        where: { donoId: req.donoId, codConvenio: importacao.codConvenio, cpf: { in: cpfs } },
        select: { cpf: true },
      })
    : [];
  const vistos = new Set(existentes.map((e) => e.cpf));

  const novos = [];
  let duplicados = 0;
  for (const r of normalizados) {
    if (r.cpf && vistos.has(r.cpf)) {
      duplicados += 1;
      continue;
    }
    if (r.cpf) vistos.add(r.cpf);
    novos.push(r);
  }

  if (novos.length) await prisma.leadImportado.createMany({ data: novos });
  await prisma.importacaoPlanilha.update({
    where: { id: importacao.id },
    data: { totalLinhas: { increment: novos.length }, duplicados: { increment: duplicados } },
  });

  res.json({ inseridos: novos.length, duplicados });
});

importacoes.post('/:id/concluir', async (req, res) => {
  const resultado = await prisma.importacaoPlanilha.updateMany({
    where: { id: req.params.id, donoId: req.donoId },
    data: { status: 'IMPORTADO', dataImportacao: new Date() },
  });
  if (!resultado.count) return res.status(404).json({ erro: 'Importação não encontrada.' });
  res.json({ ok: true });
});

importacoes.delete('/:id', async (req, res) => {
  const resultado = await prisma.importacaoPlanilha.deleteMany({
    where: { id: req.params.id, donoId: req.donoId },
  });
  if (!resultado.count) return res.status(404).json({ erro: 'Importação não encontrada.' });
  res.json({ ok: true });
});

// ============================================================
// Leads importados (a "base"): supervisores veem tudo da equipe,
// promotor vê apenas os leads atribuídos a ele
// ============================================================

export const leads = Router();
leads.use(autenticar);

const escopoLeads = (req) => ({
  donoId: req.donoId,
  ...(req.usuario.perfil === 'PROMOTOR' && { funcionarioId: req.usuario.id }),
});

const SEM_CONVENIO = '(sem convênio)';

/** Filtros da base de leads (query string ou corpo), sempre dentro do escopo de quem pede. */
function montarWhere(req, f = {}, { leitura = false } = {}) {
  // leitura: inclui as bases compartilhadas do master; ações que alteram leads ficam só na equipe
  const where = leitura ? escopoLeitura(req) : escopoLeads(req);
  const { q, statusLead, importacaoId, convenio, convenioNome, funcionarioId, semResponsavel } = f;
  // O master pode olhar uma equipe específica (as bases dos supervisores)
  if (leitura && req.usuario.perfil === 'MASTER' && f.equipeId) where.donoId = String(f.equipeId);
  const E = [];

  if (statusLead) where.statusLead = String(statusLead);
  if (semResponsavel === '1' || semResponsavel === true) where.funcionarioId = null;
  else if (funcionarioId && req.usuario.perfil !== 'PROMOTOR') where.funcionarioId = String(funcionarioId);
  if (importacaoId) where.importacaoId = String(importacaoId);
  if (convenio) where.codConvenio = String(convenio);
  if (convenioNome) where.convenio = String(convenioNome) === SEM_CONVENIO ? null : String(convenioNome);

  const t = String(q ?? '').trim();
  if (t) {
    where.OR = [{ nome: { contains: t } }, { cpf: { contains: t.replace(/\D/g, '') || t } }, { telefone: { contains: t } }];
  }
  // Filtros por campo (cada um restringe o resultado, e todos se combinam)
  const campo = (v) => String(v ?? '').trim();
  const digitos = (v) => campo(v).replace(/[^0-9]/g, '');
  const dia = (v) => (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(campo(v)) ? campo(v) : null);
  if (campo(f.nome)) E.push({ nome: { contains: campo(f.nome) } });
  if (digitos(f.cpf)) E.push({ cpf: { contains: digitos(f.cpf) } });
  if (digitos(f.telefone)) E.push({ telefone: { contains: digitos(f.telefone) } });
  if (campo(f.matricula)) E.push({ matricula: { contains: campo(f.matricula) } });
  const valorMargem = (v) => (campo(v) === '' ? null : paraNumero(v));
  if (valorMargem(f.margemDe) !== null) E.push({ margemValor: { gte: valorMargem(f.margemDe) } });
  if (valorMargem(f.margemAte) !== null) E.push({ margemValor: { lte: valorMargem(f.margemAte) } });
  if (dia(f.de)) E.push({ criadoEm: { gte: new Date(dia(f.de) + 'T00:00:00') } });
  if (dia(f.ate)) E.push({ criadoEm: { lte: new Date(dia(f.ate) + 'T23:59:59.999') } });
  if (E.length) where.AND = [...(where.AND ?? []), ...E];
  return where;
}

const ORDENAVEIS = new Set(['nome', 'cpf', 'telefone', 'convenio', 'statusLead', 'criadoEm']);
function montarOrdem(ordenar) {
  const [campo, dir] = String(ordenar ?? '').split(':');
  if (!ORDENAVEIS.has(campo)) return { criadoEm: 'desc' };
  return { [campo]: dir === 'asc' ? 'asc' : 'desc' };
}

leads.get('/', async (req, res) => {
  const where = montarWhere(req, req.query, { leitura: true });
  const limite = Math.min(Number(req.query.limite) || 50, 200);
  const pagina = Math.max(Number(req.query.pagina) || 1, 1);

  const [total, itens] = await Promise.all([
    prisma.leadImportado.count({ where }),
    prisma.leadImportado.findMany({
      where,
      orderBy: montarOrdem(req.query.ordenar),
      skip: (pagina - 1) * limite,
      take: limite,
    }),
  ]);

  // "Indisponível": o CPF já foi pego por alguém. Só master e supervisor veem quem pegou.
  const reservas = await reservasPorCpf(itens.map((l) => l.cpf));
  const nomes = new Map();
  const reveladas = [...reservas.values()].filter((r) => veNomeDeQuemPegou(req, r));
  if (reveladas.length) {
    const ids = [...new Set(reveladas.map((r) => r.donoDoCliente))];
    for (const u of await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })) nomes.set(u.id, u.nome);
  }
  const comReserva = itens.map((l) => {
    const r = reservas.get(apenasDigitos(l.cpf));
    if (!r) return l;
    const minha = r.donoDoCliente === req.usuario.id;
    return { ...l, reserva: { minha, expiraEm: r.expiraEm, ...(!minha && veNomeDeQuemPegou(req, r) && { por: nomes.get(r.donoDoCliente) ?? null }) } };
  });
  res.json({ itens: comReserva, total, pagina, limite });
});

// Convênios em que um CPF aparece (para avisar o atendente antes de abordar o cliente)
leads.get('/cpf/:cpf', async (req, res) => {
  const cpf = String(req.params.cpf).replace(/\D/g, '');
  if (cpf.length < 11) return res.json({ convenios: [] });
  const grupos = await prisma.leadImportado.groupBy({ by: ['convenio'], where: { ...escopoLeitura(req), cpf } });
  res.json({ convenios: grupos.map((g) => g.convenio ?? SEM_CONVENIO) });
});

// ---------- Ações em lote, exportação e carteira ----------

const MAX_LOTE = 50_000;

const alvoSchema = z.object({
  ids: z.array(z.string().uuid()).max(2000).optional(),
  // Para agir em "todos os resultados do filtro" é preciso confirmar explicitamente
  filtros: z.record(z.any()).optional(),
  todosDoFiltro: z.boolean().optional(),
});

/** Resolve o conjunto de leads alvo (ids marcados ou todo o filtro), sempre dentro do escopo. */
function alvoDosLeads(req, dados, { leitura = false } = {}) {
  // Ao escolher clientes para trabalhar, o master também fica só com as bases dele
  const escopo = () => (leitura ? escopoLeitura(req, { paraTrabalhar: true }) : escopoLeads(req));
  if (dados.ids?.length) return { ...escopo(), id: { in: dados.ids } };
  if (dados.todosDoFiltro) {
    const filtro = montarWhere(req, dados.filtros ?? {}, { leitura });
    return leitura && req.usuario.perfil === 'MASTER' ? { AND: [filtro, escopo()] } : filtro;
  }
  return null;
}

const loteSchema = alvoSchema.extend({
  statusLead: z.string().trim().min(1).max(40).optional(),
  funcionarioId: z.string().uuid().nullable().optional(),
});

leads.post('/lote', async (req, res) => {
  const dados = loteSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const where = alvoDosLeads(req, dados.data);
  if (!where) return res.status(400).json({ erro: 'Selecione os leads ou confirme a ação sobre todo o filtro.' });

  const { statusLead, funcionarioId } = dados.data;
  if (statusLead === undefined && funcionarioId === undefined) {
    return res.status(400).json({ erro: 'Informe a situação ou o responsável.' });
  }

  const data = {};
  if (statusLead !== undefined) data.statusLead = statusLead;
  if (funcionarioId !== undefined) {
    if (req.usuario.perfil === 'PROMOTOR') return res.status(403).json({ erro: 'Sem permissão para atribuir leads.' });
    if (funcionarioId) {
      const alvo = await prisma.usuario.findFirst({
        where: { id: funcionarioId, ativo: true, OR: [{ id: req.donoId }, { superiorId: req.donoId }] },
      });
      if (!alvo) return res.status(400).json({ erro: 'Usuário não pertence à sua equipe.' });
    }
    data.funcionarioId = funcionarioId;
  }

  if ((await prisma.leadImportado.count({ where })) > MAX_LOTE) {
    return res.status(400).json({ erro: `A ação atinge mais de ${MAX_LOTE.toLocaleString('pt-BR')} leads. Refine o filtro.` });
  }
  const r = await prisma.leadImportado.updateMany({ where, data });
  res.json({ atualizados: r.count });
});

// Evita que o Excel execute fórmulas escondidas em células de texto
const celulaCsv = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

leads.get('/exportar', async (req, res) => {
  const where = montarWhere(req, req.query, { leitura: true });
  const itens = await prisma.leadImportado.findMany({ where, orderBy: montarOrdem(req.query.ordenar), take: MAX_LOTE });

  const idsResp = [...new Set(itens.map((l) => l.funcionarioId).filter(Boolean))];
  const usuarios = idsResp.length
    ? await prisma.usuario.findMany({ where: { id: { in: idsResp } }, select: { id: true, nome: true } })
    : [];
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));

  const extras = [...new Set(itens.flatMap((l) => Object.keys(l.dados ?? {})))].sort().slice(0, 60);
  const fixas = ['Nome', 'CPF', 'Telefone', 'Convênio', 'Cód. convênio', 'Matrícula', 'Margem livre', 'Situação', 'Responsável', 'Observação', 'Importado em'];
  const linhas = [[...fixas, ...extras].map(celulaCsv).join(';')];
  for (const l of itens) {
    linhas.push(
      [
        l.nome, l.cpf, l.telefone, l.convenio, l.codConvenio, l.matricula, l.margem, l.statusLead,
        l.funcionarioId ? nomes.get(l.funcionarioId) ?? '' : '', l.observacao, l.criadoEm.toISOString().slice(0, 19).replace('T', ' '),
        ...extras.map((k) => l.dados?.[k]),
      ]
        .map(celulaCsv)
        .join(';'),
    );
  }

  const nomeArquivo = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  // BOM para o Excel reconhecer os acentos
  res.send(`\uFEFF${linhas.join('\r\n')}`);
});

/**
 * Leads marcados viram oportunidades no estágio "Novo" (e entram na carteira, como toda oportunidade).
 * Quem já foi pego (oportunidade com o mesmo CPF ainda dentro dos 5 dias de reserva) é ignorado: fica indisponível para os demais.
 */
const enviarOportunidadeSchema = alvoSchema.extend({
  // Para quem mandar o cliente (master e supervisor); sem isso, vale o responsável do lead ou quem envia
  responsavelId: z.string().uuid().optional(),
});

leads.post('/enviar-oportunidade', async (req, res) => {
  const dados = enviarOportunidadeSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  // Só quem gerencia a equipe escolhe o responsável, e ele precisa ser da equipe
  let destino = null;
  if (dados.data.responsavelId && req.usuario.perfil !== 'PROMOTOR') {
    destino = await prisma.usuario.findFirst({
      where: { id: dados.data.responsavelId, ativo: true, OR: [{ id: req.donoId }, { superiorId: req.donoId }] },
      select: { id: true, nome: true },
    });
    if (!destino) return res.status(400).json({ erro: 'O responsável escolhido não pertence à sua equipe.' });
  }

  const where = alvoDosLeads(req, dados.data, { leitura: true });
  if (!where) return res.status(400).json({ erro: 'Selecione os leads ou confirme a ação sobre todo o filtro.' });

  const origem = await prisma.leadImportado.findMany({ where: { ...where, cpf: { not: null } }, take: MAX_LOTE });
  if (!origem.length) return res.json({ criados: 0, ignorados: 0 });

  // Cliente já pego por alguém (qualquer estágio) fica indisponível para os demais
  const jaTem = new Set((await reservasPorCpf(origem.map((l) => l.cpf))).keys());

  const agora = new Date();
  const novas = [];
  for (const l of origem) {
    const cpf = apenasDigitos(l.cpf);
    if (!cpf || jaTem.has(cpf)) continue;
    jaTem.add(cpf);
    const extra = l.dados && typeof l.dados === 'object' ? l.dados : {};
    novas.push({
      donoId: req.donoId,
      nome: l.nome ?? 'Sem nome',
      cpf,
      telefone: l.telefone,
      email: typeof extra.email === 'string' ? extra.email : null,
      empresa: l.convenio,
      estagio: 'novo',
      responsavelId: req.usuario.perfil === 'PROMOTOR' ? req.usuario.id : destino?.id ?? l.funcionarioId ?? req.usuario.id,
      detalhes: {
        ...extra,
        ...(l.matricula && { matricula: l.matricula }),
        ...(l.margemValor !== null && l.margemValor !== undefined && { emp_livre: Number(l.margemValor) }),
      },
      estagioAtualizadoEm: agora,
      atividades: [{ data: agora.toISOString(), usuario: req.usuario.nome, estagio: 'Novo', descricao: 'Enviado da base de leads' }],
    });
  }
  if (novas.length) await prisma.oportunidade.createMany({ data: novas });
  for (const o of novas) await garantirNaCarteira(req.donoId, o);

  // Avisa o promotor que recebeu clientes (não avisa quem mandou para si mesmo)
  if (novas.length && destino && destino.id !== req.usuario.id) {
    criarNotificacao({
      donoId: req.donoId,
      usuarioId: destino.id,
      tipo: 'clientes_recebidos',
      titulo: 'Novos clientes para você',
      mensagem: `${req.usuario.nome} enviou ${novas.length} cliente(s) para as suas oportunidades.`,
    });
  }
  res.json({ criados: novas.length, ignorados: origem.length - novas.length });
});

// ---------- Apoio à distribuição e acompanhamento ----------

const podeGerirEquipe = (req, res, next) =>
  ['MASTER', 'SUPERVISOR'].includes(req.usuario.perfil)
    ? next()
    : res.status(403).json({ erro: 'Apenas master e supervisor podem fazer isso.' });

/** Convênios presentes na base, com total e quantos estão sem responsável. */
leads.get('/convenios', podeGerirEquipe, async (req, res) => {
  const grupos = await prisma.leadImportado.groupBy({
    by: ['convenio', 'funcionarioId'],
    where: { donoId: req.donoId },
    _count: { _all: true },
  });
  const mapa = new Map();
  for (const g of grupos) {
    const nome = g.convenio ?? '(sem convênio)';
    const atual = mapa.get(nome) ?? { convenio: nome, total: 0, semResponsavel: 0 };
    atual.total += g._count._all;
    if (!g.funcionarioId) atual.semResponsavel += g._count._all;
    mapa.set(nome, atual);
  }
  res.json({ itens: [...mapa.values()].sort((a, b) => a.convenio.localeCompare(b.convenio)) });
});

/** Quantos leads cada responsável tem, por situação. */
leads.get('/resumo', podeGerirEquipe, async (req, res) => {
  const where = { donoId: req.donoId };
  if (req.query.importacaoId) where.importacaoId = String(req.query.importacaoId);

  const grupos = await prisma.leadImportado.groupBy({
    by: ['funcionarioId', 'statusLead'],
    where,
    _count: { _all: true },
  });

  const ids = [...new Set(grupos.map((g) => g.funcionarioId).filter(Boolean))];
  const usuarios = ids.length
    ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, perfil: true } })
    : [];
  const nomes = new Map(usuarios.map((u) => [u.id, u]));

  const mapa = new Map();
  for (const g of grupos) {
    const chave = g.funcionarioId ?? 'sem';
    const atual =
      mapa.get(chave) ?? {
        funcionarioId: g.funcionarioId,
        nome: g.funcionarioId ? nomes.get(g.funcionarioId)?.nome ?? 'Usuário removido' : 'Sem responsável',
        total: 0,
        porStatus: {},
      };
    atual.total += g._count._all;
    atual.porStatus[g.statusLead] = (atual.porStatus[g.statusLead] ?? 0) + g._count._all;
    mapa.set(chave, atual);
  }
  res.json({ itens: [...mapa.values()].sort((a, b) => b.total - a.total) });
});

const distribuirSchema = z.object({
  usuarioIds: z.array(z.string().uuid()).min(1, 'Escolha ao menos um promotor.'),
  importacaoId: z.string().uuid().optional(),
  convenio: z.string().trim().optional(),
  quantidade: z.coerce.number().int().min(1).optional(),
});

/**
 * Reparte, em rodízio, leads sem responsável entre promotores da equipe.
 * `filtroLeads` restringe a origem (importação, convênio, campanha...).
 */
export async function distribuirLeads({ donoId, usuarioIds, filtroLeads = {}, quantidade }) {
  const promotores = await prisma.usuario.findMany({
    where: { id: { in: usuarioIds }, ativo: true, perfil: 'PROMOTOR', superiorId: donoId },
    select: { id: true, nome: true },
  });
  if (!promotores.length) {
    const erro = new Error('Nenhum dos usuários escolhidos é promotor ativo da sua equipe.');
    erro.status = 400;
    throw erro;
  }

  const leadsLivres = await prisma.leadImportado.findMany({
    where: { ...filtroLeads, donoId, funcionarioId: null },
    select: { id: true },
    orderBy: { criadoEm: 'asc' },
    ...(quantidade && { take: quantidade }),
  });

  const baldes = new Map(promotores.map((p) => [p.id, []]));
  leadsLivres.forEach((l, i) => baldes.get(promotores[i % promotores.length].id).push(l.id));

  const porUsuario = [];
  for (const [usuarioId, ids] of baldes) {
    for (let i = 0; i < ids.length; i += 1000) {
      await prisma.leadImportado.updateMany({
        where: { id: { in: ids.slice(i, i + 1000) }, donoId },
        data: { funcionarioId: usuarioId },
      });
    }
    porUsuario.push({ usuarioId, nome: promotores.find((p) => p.id === usuarioId).nome, quantidade: ids.length });
    if (ids.length) {
      criarNotificacao({
        donoId,
        usuarioId,
        tipo: 'leads_recebidos',
        titulo: 'Você recebeu novos leads',
        mensagem: `${ids.length.toLocaleString('pt-BR')} leads foram atribuídos a você.`,
      });
    }
  }
  return { distribuidos: leadsLivres.length, porUsuario };
}

leads.post('/distribuir', podeGerirEquipe, async (req, res) => {
  const dados = distribuirSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const { usuarioIds, importacaoId, convenio, quantidade } = dados.data;
  const filtroLeads = {};
  if (importacaoId) filtroLeads.importacaoId = importacaoId;
  if (convenio) filtroLeads.convenio = convenio;

  try {
    res.json(await distribuirLeads({ donoId: req.donoId, usuarioIds, filtroLeads, quantidade }));
  } catch (e) {
    res.status(e.status ?? 500).json({ erro: e.status ? e.message : 'Erro ao distribuir.' });
  }
});

/** Tira o responsável de leads (devolve para "sem responsável"). */
leads.post('/devolver', podeGerirEquipe, async (req, res) => {
  const dados = z
    .object({ funcionarioId: z.string().uuid(), importacaoId: z.string().uuid().optional() })
    .safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const r = await prisma.leadImportado.updateMany({
    where: {
      donoId: req.donoId,
      funcionarioId: dados.data.funcionarioId,
      statusLead: 'novo',
      ...(dados.data.importacaoId && { importacaoId: dados.data.importacaoId }),
    },
    data: { funcionarioId: null },
  });
  res.json({ devolvidos: r.count });
});

const leadSchema = z.object({
  statusLead: z.string().trim().min(1).optional(),
  observacao: z.string().trim().nullable().optional(),
  funcionarioId: z.string().uuid().nullable().optional(),
});

leads.put('/:id', async (req, res) => {
  const dados = leadSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const atual = await prisma.leadImportado.findFirst({ where: { id: req.params.id, ...escopoLeads(req) } });
  if (!atual) return res.status(404).json({ erro: 'Lead não encontrado.' });

  // Promotor atualiza status/observação; atribuir a outro usuário é de quem gerencia a equipe
  const { funcionarioId, ...resto } = dados.data;
  const data = { ...resto };
  if (funcionarioId !== undefined) {
    if (req.usuario.perfil === 'PROMOTOR') {
      return res.status(403).json({ erro: 'Sem permissão para atribuir leads.' });
    }
    if (funcionarioId) {
      const alvo = await prisma.usuario.findFirst({
        where: { id: funcionarioId, ativo: true, OR: [{ id: req.donoId }, { superiorId: req.donoId }] },
      });
      if (!alvo) return res.status(400).json({ erro: 'Usuário não pertence à sua equipe.' });
    }
    data.funcionarioId = funcionarioId;
  }

  const item = await prisma.leadImportado.update({ where: { id: atual.id }, data });
  res.json({ item });
});
