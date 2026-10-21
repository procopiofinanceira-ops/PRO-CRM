import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { assinarToken } from '../lib/tokens.js';
import { podeEntrarComo, supervisoresVisiveis, USUARIO_PUBLICO } from '../lib/permissoes.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';

const router = Router();
router.use(autenticar, exigirPerfil('MASTER', 'GERENTE', 'BKO'));

/** Supervisores que o usuário logado pode ver (master: todos; gerente/BKO: os associados). */
async function listarSupervisores(usuario) {
  const filtro = supervisoresVisiveis(usuario);
  return prisma.usuario.findMany({
    where: { perfil: 'SUPERVISOR', ativo: true, ...filtro },
    select: { id: true, nome: true, email: true, ultimoLogin: true },
    orderBy: { nome: 'asc' },
  });
}

const contagemPor = (grupos, chave = 'donoId') => new Map(grupos.map((g) => [g[chave], g._count._all]));

// Cartões dos supervisores, com um resumo de cada equipe
router.get('/supervisores', async (req, res) => {
  const supervisores = await listarSupervisores(req.usuario);
  const ids = supervisores.map((s) => s.id);

  const [promotores, oportunidades, leads] = await Promise.all([
    prisma.usuario.groupBy({
      by: ['superiorId'],
      where: { superiorId: { in: ids }, perfil: 'PROMOTOR', ativo: true },
      _count: { _all: true },
    }),
    prisma.oportunidade.groupBy({ by: ['donoId'], where: { donoId: { in: ids } }, _count: { _all: true } }),
    prisma.leadImportado.groupBy({ by: ['donoId'], where: { donoId: { in: ids } }, _count: { _all: true } }),
  ]);

  const nPromotores = contagemPor(promotores, 'superiorId');
  const nOportunidades = contagemPor(oportunidades);
  const nLeads = contagemPor(leads);

  res.json({
    itens: supervisores.map((s) => ({
      ...s,
      promotores: nPromotores.get(s.id) ?? 0,
      oportunidades: nOportunidades.get(s.id) ?? 0,
      leads: nLeads.get(s.id) ?? 0,
    })),
  });
});

// "Acessar ambiente": gera um token que age como o supervisor, registrando quem entrou
router.post('/entrar-como', async (req, res) => {
  const dados = z.object({ usuarioId: z.string().uuid() }).safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  // Não encadeia: quem já está acessando como outro precisa voltar antes
  if (req.impersonadoPor) return res.status(400).json({ erro: 'Volte ao seu usuário antes de acessar outro ambiente.' });

  const alvo = await prisma.usuario.findFirst({ where: { id: dados.data.usuarioId, ativo: true } });
  if (!alvo || !podeEntrarComo(req.usuario, alvo)) {
    return res.status(403).json({ erro: 'Você não pode acessar este ambiente.' });
  }

  const publico = await prisma.usuario.findUnique({ where: { id: alvo.id }, select: USUARIO_PUBLICO });
  res.json({ token: assinarToken(alvo, { via: req.usuario.id, vsid: req.sid }), usuario: publico });
});

// ---------------- Painel master ----------------

const soMaster = exigirPerfil('MASTER');

// Ranking de uso: atividade de cada supervisor e sua equipe
router.get('/ranking', soMaster, async (req, res) => {
  const supervisores = await listarSupervisores(req.usuario);
  const ids = supervisores.map((s) => s.id);

  const [promotores, leads, trabalhados, oportunidades, propostas] = await Promise.all([
    prisma.usuario.groupBy({
      by: ['superiorId'],
      where: { superiorId: { in: ids }, perfil: 'PROMOTOR', ativo: true },
      _count: { _all: true },
    }),
    prisma.leadImportado.groupBy({ by: ['donoId'], where: { donoId: { in: ids } }, _count: { _all: true } }),
    prisma.leadImportado.groupBy({
      by: ['donoId'],
      where: { donoId: { in: ids }, statusLead: { not: 'novo' } },
      _count: { _all: true },
    }),
    prisma.oportunidade.groupBy({ by: ['donoId'], where: { donoId: { in: ids } }, _count: { _all: true } }),
    prisma.imobProposta.groupBy({ by: ['donoId'], where: { donoId: { in: ids } }, _count: { _all: true } }),
  ]);

  const m = {
    promotores: contagemPor(promotores, 'superiorId'),
    leads: contagemPor(leads),
    trabalhados: contagemPor(trabalhados),
    oportunidades: contagemPor(oportunidades),
    propostas: contagemPor(propostas),
  };

  const itens = supervisores
    .map((s) => {
      const totalLeads = m.leads.get(s.id) ?? 0;
      const trab = m.trabalhados.get(s.id) ?? 0;
      return {
        id: s.id,
        nome: s.nome,
        ultimoLogin: s.ultimoLogin,
        promotores: m.promotores.get(s.id) ?? 0,
        leads: totalLeads,
        leadsTrabalhados: trab,
        aproveitamento: totalLeads ? Math.round((trab / totalLeads) * 100) : 0,
        oportunidades: m.oportunidades.get(s.id) ?? 0,
        propostasImob: m.propostas.get(s.id) ?? 0,
      };
    })
    .sort((a, b) => b.leadsTrabalhados + b.oportunidades - (a.leadsTrabalhados + a.oportunidades));

  res.json({ itens });
});

// Bases importadas por todas as equipes
router.get('/bases', soMaster, async (req, res) => {
  const importacoes = await prisma.importacaoPlanilha.findMany({
    orderBy: { criadoEm: 'desc' },
    take: 100,
  });
  const ids = [...new Set(importacoes.map((i) => i.donoId))];
  const donos = ids.length
    ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
    : [];
  const nomes = new Map(donos.map((d) => [d.id, d.nome]));

  res.json({
    itens: importacoes.map((i) => ({
      id: i.id,
      arquivo: i.arquivo,
      convenio: i.convenio,
      leads: i.totalLinhas,
      duplicados: i.duplicados,
      equipe: nomes.get(i.donoId) ?? '—',
      data: i.dataImportacao ?? i.criadoEm,
    })),
  });
});

// Convênios com leads em carteira, somando todas as equipes
router.get('/convenios', soMaster, async (req, res) => {
  const grupos = await prisma.leadImportado.groupBy({
    by: ['convenio', 'statusLead'],
    _count: { _all: true },
  });
  const mapa = new Map();
  for (const g of grupos) {
    const nome = g.convenio ?? '(sem convênio)';
    const c = mapa.get(nome) ?? { convenio: nome, total: 0, novos: 0, emTrabalho: 0, convertidos: 0 };
    const n = g._count._all;
    c.total += n;
    if (g.statusLead === 'novo') c.novos += n;
    else if (g.statusLead === 'convertido') c.convertidos += n;
    else c.emTrabalho += n;
    mapa.set(nome, c);
  }
  res.json({ itens: [...mapa.values()].sort((a, b) => b.total - a.total) });
});

// Resumo do dia de uma equipe
router.get('/supervisores/:id/dia', soMaster, async (req, res) => {
  const supervisor = await prisma.usuario.findFirst({ where: { id: req.params.id, perfil: 'SUPERVISOR' } });
  if (!supervisor) return res.status(404).json({ erro: 'Supervisor não encontrado.' });

  const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(req.query.data);
  const base = dia.success ? new Date(`${dia.data}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
  const intervalo = { gte: base, lt: new Date(base.getTime() + 24 * 60 * 60 * 1000) };
  const donoId = supervisor.id;

  const [contatos, opCriadas, opAtualizadas, leadsTrabalhados, propostasCriadas, propostasAtualizadas] =
    await Promise.all([
      prisma.contato.count({ where: { donoId, criadoEm: intervalo } }),
      prisma.oportunidade.count({ where: { donoId, criadoEm: intervalo } }),
      prisma.oportunidade.count({ where: { donoId, atualizadoEm: intervalo, criadoEm: { lt: intervalo.gte } } }),
      prisma.leadImportado.count({ where: { donoId, atualizadoEm: intervalo, statusLead: { not: 'novo' } } }),
      prisma.imobProposta.count({ where: { donoId, criadoEm: intervalo } }),
      prisma.imobProposta.count({ where: { donoId, atualizadoEm: intervalo, criadoEm: { lt: intervalo.gte } } }),
    ]);

  res.json({
    supervisor: { id: supervisor.id, nome: supervisor.nome },
    data: intervalo.gte.toISOString().slice(0, 10),
    contatosCriados: contatos,
    oportunidadesCriadas: opCriadas,
    oportunidadesAtualizadas: opAtualizadas,
    leadsTrabalhados,
    propostasCriadas,
    propostasAtualizadas,
  });
});

export default router;
