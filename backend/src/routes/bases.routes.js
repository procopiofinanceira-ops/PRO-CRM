import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { autenticar } from '../middleware/auth.js';

// Visão por convênio da base de leads (os "cartões" da tela Bases).
// O promotor só enxerga os leads atribuídos a ele; os demais, a base inteira da equipe.

const router = Router();
router.use(autenticar);

const SEM_CONVENIO = '(sem convênio)';
const UM_DIA = 24 * 60 * 60 * 1000;

const ehPromotor = (req) => req.usuario.perfil === 'PROMOTOR';
const escopo = (req) => ({ donoId: req.donoId, ...(ehPromotor(req) && { funcionarioId: req.usuario.id }) });
const chaveConvenio = (c) => c ?? SEM_CONVENIO;
const numero = (v) => Number(v ?? 0);

/** CPFs presentes em mais de um convênio (só para quem gerencia a equipe). */
async function contarDuplicados(donoId) {
  const [r] = await prisma.$queryRaw`
    SELECT COUNT(*) AS n FROM (
      SELECT cpf FROM leads_importados
      WHERE dono_id = ${donoId} AND cpf IS NOT NULL
      GROUP BY cpf HAVING COUNT(DISTINCT convenio) > 1
    ) t`;
  return numero(r?.n);
}

// ---------------- Indicadores gerais ----------------
router.get('/resumo', async (req, res) => {
  const where = escopo(req);
  const [totalLeads, trabalhados, convenios, semResponsavel, importacoes, ultima] = await Promise.all([
    prisma.leadImportado.count({ where }),
    prisma.leadImportado.count({ where: { ...where, statusLead: { not: 'novo' } } }),
    prisma.leadImportado.groupBy({ by: ['convenio'], where }),
    ehPromotor(req) ? 0 : prisma.leadImportado.count({ where: { ...where, funcionarioId: null } }),
    ehPromotor(req) ? 0 : prisma.importacaoPlanilha.count({ where: { donoId: req.donoId } }),
    prisma.leadImportado.aggregate({ where, _max: { criadoEm: true } }),
  ]);

  res.json({
    totalLeads,
    trabalhados,
    aproveitamento: totalLeads ? Math.round((trabalhados / totalLeads) * 100) : 0,
    convenios: convenios.length,
    importacoes,
    semResponsavel,
    duplicados: ehPromotor(req) ? 0 : await contarDuplicados(req.donoId),
    ultimaAtualizacao: ultima._max.criadoEm,
  });
});

// ---------------- Um cartão por convênio ----------------
router.get('/convenios', async (req, res) => {
  const where = escopo(req);
  const { q, importador, de, ate } = req.query;

  // Filtros por importação (quem importou, e quando) restringem os convênios exibidos
  let convenioPermitidos = null;
  if (!ehPromotor(req) && (importador || de || ate)) {
    const filtroImp = { donoId: req.donoId };
    if (importador) filtroImp.criadorId = String(importador);
    if (de || ate) {
      filtroImp.criadoEm = {
        ...(de && { gte: new Date(`${de}T00:00:00`) }),
        ...(ate && { lt: new Date(new Date(`${ate}T00:00:00`).getTime() + UM_DIA) }),
      };
    }
    const imps = await prisma.importacaoPlanilha.findMany({ where: filtroImp, select: { convenio: true } });
    convenioPermitidos = new Set(imps.map((i) => chaveConvenio(i.convenio)));
  }

  const busca = String(q ?? '').trim();
  if (busca) where.OR = [{ convenio: { contains: busca } }, { codConvenio: { contains: busca } }];

  const [porConvenio, porStatus, porResponsavel] = await Promise.all([
    prisma.leadImportado.groupBy({
      by: ['convenio', 'codConvenio'],
      where,
      _count: { _all: true },
      _max: { criadoEm: true },
    }),
    prisma.leadImportado.groupBy({ by: ['convenio', 'statusLead'], where, _count: { _all: true } }),
    prisma.leadImportado.groupBy({ by: ['convenio', 'funcionarioId'], where, _count: { _all: true } }),
  ]);

  const cartoes = new Map();
  for (const g of porConvenio) {
    const nome = chaveConvenio(g.convenio);
    const c = cartoes.get(nome) ?? {
      convenio: nome,
      codConvenio: null,
      totalLeads: 0,
      ultimaAtualizacao: null,
      porStatus: {},
      semResponsavel: 0,
      responsaveis: [],
      importacoes: 0,
      importadores: [],
      multiConvenio: 0,
    };
    c.totalLeads += g._count._all;
    c.codConvenio ??= g.codConvenio;
    if (!c.ultimaAtualizacao || g._max.criadoEm > c.ultimaAtualizacao) c.ultimaAtualizacao = g._max.criadoEm;
    cartoes.set(nome, c);
  }
  for (const g of porStatus) {
    const c = cartoes.get(chaveConvenio(g.convenio));
    if (c) c.porStatus[g.statusLead] = (c.porStatus[g.statusLead] ?? 0) + g._count._all;
  }

  const idsResp = [...new Set(porResponsavel.map((g) => g.funcionarioId).filter(Boolean))];
  const usuarios = idsResp.length
    ? await prisma.usuario.findMany({ where: { id: { in: idsResp } }, select: { id: true, nome: true } })
    : [];
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  for (const g of porResponsavel) {
    const c = cartoes.get(chaveConvenio(g.convenio));
    if (!c) continue;
    if (!g.funcionarioId) c.semResponsavel += g._count._all;
    else c.responsaveis.push({ id: g.funcionarioId, nome: nomes.get(g.funcionarioId) ?? 'Usuário removido', quantidade: g._count._all });
  }

  if (!ehPromotor(req)) {
    // Importações (quem importou e quantas) e clientes que aparecem em mais de um convênio
    const [importacoes, multi] = await Promise.all([
      prisma.importacaoPlanilha.findMany({
        where: { donoId: req.donoId },
        select: { convenio: true, criadorId: true },
      }),
      prisma.$queryRaw`
        SELECT l.convenio AS convenio, COUNT(DISTINCT l.cpf) AS n
        FROM leads_importados l
        WHERE l.dono_id = ${req.donoId}
          AND l.cpf IN (
            SELECT cpf FROM leads_importados
            WHERE dono_id = ${req.donoId} AND cpf IS NOT NULL
            GROUP BY cpf HAVING COUNT(DISTINCT convenio) > 1
          )
        GROUP BY l.convenio`,
    ]);

    const idsImp = [...new Set(importacoes.map((i) => i.criadorId).filter(Boolean))];
    const importadores = idsImp.length
      ? await prisma.usuario.findMany({ where: { id: { in: idsImp } }, select: { id: true, nome: true } })
      : [];
    const nomeImp = new Map(importadores.map((u) => [u.id, u.nome]));

    for (const i of importacoes) {
      const c = cartoes.get(chaveConvenio(i.convenio));
      if (!c) continue;
      c.importacoes += 1;
      const nome = nomeImp.get(i.criadorId);
      if (nome && !c.importadores.includes(nome)) c.importadores.push(nome);
    }
    for (const m of multi) {
      const c = cartoes.get(chaveConvenio(m.convenio));
      if (c) c.multiConvenio = numero(m.n);
    }
  }

  const agora = Date.now();
  const itens = [...cartoes.values()]
    .filter((c) => !convenioPermitidos || convenioPermitidos.has(c.convenio))
    .map((c) => ({
      ...c,
      responsaveis: c.responsaveis.sort((a, b) => b.quantidade - a.quantidade),
      recente: c.ultimaAtualizacao ? agora - new Date(c.ultimaAtualizacao).getTime() < UM_DIA : false,
    }))
    .sort((a, b) => new Date(b.ultimaAtualizacao ?? 0) - new Date(a.ultimaAtualizacao ?? 0));

  res.json({ itens });
});

// ---------------- Clientes em mais de um convênio ----------------
router.get('/duplicados', async (req, res) => {
  if (ehPromotor(req)) return res.status(403).json({ erro: 'Sem permissão para esta ação.' });

  const limite = Math.min(Number(req.query.limite) || 100, 200);
  const pagina = Math.max(Number(req.query.pagina) || 1, 1);
  const donoId = req.donoId;

  const [linhas, total] = await Promise.all([
    prisma.$queryRaw`
      SELECT cpf, MIN(nome) AS nome, COUNT(DISTINCT convenio) AS convenios_n,
             GROUP_CONCAT(DISTINCT COALESCE(convenio, '(sem convênio)') SEPARATOR '||') AS convenios
      FROM leads_importados
      WHERE dono_id = ${donoId} AND cpf IS NOT NULL
      GROUP BY cpf HAVING COUNT(DISTINCT convenio) > 1
      ORDER BY convenios_n DESC, nome ASC
      LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
    contarDuplicados(donoId),
  ]);

  res.json({
    total,
    pagina,
    limite,
    itens: linhas.map((l) => ({
      cpf: l.cpf,
      nome: l.nome,
      quantidade: numero(l.convenios_n),
      convenios: String(l.convenios ?? '').split('||').filter(Boolean),
    })),
  });
});

export default router;
