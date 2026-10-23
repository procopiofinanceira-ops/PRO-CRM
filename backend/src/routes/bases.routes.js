import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { autenticar } from '../middleware/auth.js';
import { escopoLeitura } from '../lib/escopoBases.js';

// Visão por convênio da base de leads (os "cartões" da tela Bases).
// Promotor: os leads dele e a fila livre. Supervisor e demais: a equipe mais as bases do master.
// Master: as bases de todas as equipes, com um cartão por supervisor e convênio.

const router = Router();
router.use(autenticar);

const SEM_CONVENIO = '(sem convênio)';
const UM_DIA = 24 * 60 * 60 * 1000;

const ehPromotor = (req) => req.usuario.perfil === 'PROMOTOR';
const ehMaster = (req) => req.usuario.perfil === 'MASTER';
// Inclui as bases importadas pelo master (a fila sem responsável) além das da própria equipe
const escopo = escopoLeitura;
const chaveConvenio = (c) => c ?? SEM_CONVENIO;
const numero = (v) => Number(v ?? 0);

/** Filtro por equipe (só o master escolhe de qual supervisor quer ver). */
const comEquipe = (req, where) => {
  const equipe = String(req.query.equipe ?? '');
  if (ehMaster(req) && equipe) where.donoId = equipe;
  return where;
};

/** CPFs presentes em mais de um convênio: dentro da equipe, ou em todas as equipes para o master. */
async function contarDuplicados(req) {
  const [r] = ehMaster(req)
    ? await prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM (
          SELECT cpf FROM leads_importados
          WHERE cpf IS NOT NULL
          GROUP BY dono_id, cpf HAVING COUNT(DISTINCT convenio) > 1
        ) t`
    : await prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM (
          SELECT cpf FROM leads_importados
          WHERE dono_id = ${req.donoId} AND cpf IS NOT NULL
          GROUP BY cpf HAVING COUNT(DISTINCT convenio) > 1
        ) t`;
  return numero(r?.n);
}

// ---------------- Indicadores gerais ----------------
router.get('/resumo', async (req, res) => {
  const where = comEquipe(req, escopo(req));
  const filtroImp = ehMaster(req) ? (where.donoId ? { donoId: where.donoId } : {}) : { donoId: req.donoId };
  const [totalLeads, trabalhados, convenios, semResponsavel, importacoes, ultima] = await Promise.all([
    prisma.leadImportado.count({ where }),
    prisma.leadImportado.count({ where: { ...where, statusLead: { not: 'novo' } } }),
    prisma.leadImportado.groupBy({ by: ehMaster(req) ? ['donoId', 'convenio'] : ['convenio'], where }),
    ehPromotor(req) ? 0 : prisma.leadImportado.count({ where: { ...where, funcionarioId: null } }),
    ehPromotor(req) ? 0 : prisma.importacaoPlanilha.count({ where: filtroImp }),
    prisma.leadImportado.aggregate({ where, _max: { criadoEm: true } }),
  ]);

  res.json({
    totalLeads,
    trabalhados,
    aproveitamento: totalLeads ? Math.round((trabalhados / totalLeads) * 100) : 0,
    convenios: convenios.length,
    importacoes,
    semResponsavel,
    duplicados: ehPromotor(req) ? 0 : await contarDuplicados(req),
    ultimaAtualizacao: ultima._max.criadoEm,
  });
});

// ---------------- Um cartão por convênio ----------------
router.get('/convenios', async (req, res) => {
  const where = comEquipe(req, escopo(req));
  const { q, importador, de, ate } = req.query;
  const master = ehMaster(req);
  // Para o master, o mesmo convênio em equipes diferentes vira cartões separados
  const chave = (donoId, convenio) => (master ? `${donoId}|${chaveConvenio(convenio)}` : chaveConvenio(convenio));
  const agrupar = master ? ['donoId'] : [];

  // Filtros por importação (quem importou, e quando) restringem os convênios exibidos
  let convenioPermitidos = null;
  const filtroImp = master ? (where.donoId ? { donoId: where.donoId } : {}) : { donoId: req.donoId };
  if (!ehPromotor(req) && (importador || de || ate)) {
    const f = { ...filtroImp };
    if (importador) f.criadorId = String(importador);
    if (de || ate) {
      f.criadoEm = {
        ...(de && { gte: new Date(`${de}T00:00:00`) }),
        ...(ate && { lt: new Date(new Date(`${ate}T00:00:00`).getTime() + UM_DIA) }),
      };
    }
    const imps = await prisma.importacaoPlanilha.findMany({ where: f, select: { convenio: true, donoId: true } });
    convenioPermitidos = new Set(imps.map((i) => chave(i.donoId, i.convenio)));
  }

  const busca = String(q ?? '').trim();
  if (busca) where.OR = [{ convenio: { contains: busca } }, { codConvenio: { contains: busca } }];

  const [porConvenio, porStatus, porResponsavel] = await Promise.all([
    prisma.leadImportado.groupBy({
      by: [...agrupar, 'convenio', 'codConvenio'],
      where,
      _count: { _all: true },
      _max: { criadoEm: true },
    }),
    prisma.leadImportado.groupBy({ by: [...agrupar, 'convenio', 'statusLead'], where, _count: { _all: true } }),
    prisma.leadImportado.groupBy({ by: [...agrupar, 'convenio', 'funcionarioId'], where, _count: { _all: true } }),
  ]);

  const cartoes = new Map();
  for (const g of porConvenio) {
    const k = chave(g.donoId, g.convenio);
    const c = cartoes.get(k) ?? {
      convenio: chaveConvenio(g.convenio),
      donoId: master ? g.donoId : null,
      equipe: null,
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
    cartoes.set(k, c);
  }
  for (const g of porStatus) {
    const c = cartoes.get(chave(g.donoId, g.convenio));
    if (c) c.porStatus[g.statusLead] = (c.porStatus[g.statusLead] ?? 0) + g._count._all;
  }

  const idsResp = [...new Set(porResponsavel.map((g) => g.funcionarioId).filter(Boolean))];
  const idsEquipe = master ? [...new Set([...cartoes.values()].map((c) => c.donoId))] : [];
  const usuarios = idsResp.length || idsEquipe.length
    ? await prisma.usuario.findMany({ where: { id: { in: [...idsResp, ...idsEquipe] } }, select: { id: true, nome: true } })
    : [];
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  for (const c of cartoes.values()) if (master) c.equipe = nomes.get(c.donoId) ?? null;
  for (const g of porResponsavel) {
    const c = cartoes.get(chave(g.donoId, g.convenio));
    if (!c) continue;
    if (!g.funcionarioId) c.semResponsavel += g._count._all;
    else c.responsaveis.push({ id: g.funcionarioId, nome: nomes.get(g.funcionarioId) ?? 'Usuário removido', quantidade: g._count._all });
  }

  if (!ehPromotor(req)) {
    // Importações (quem importou e quantas) e clientes que aparecem em mais de um convênio
    const [importacoes, multi] = await Promise.all([
      prisma.importacaoPlanilha.findMany({ where: filtroImp, select: { convenio: true, criadorId: true, donoId: true } }),
      master
        ? prisma.$queryRaw`
            SELECT l.dono_id AS dono_id, l.convenio AS convenio, COUNT(DISTINCT l.cpf) AS n
            FROM leads_importados l
            WHERE (l.dono_id, l.cpf) IN (
              SELECT dono_id, cpf FROM leads_importados
              WHERE cpf IS NOT NULL
              GROUP BY dono_id, cpf HAVING COUNT(DISTINCT convenio) > 1
            )
            GROUP BY l.dono_id, l.convenio`
        : prisma.$queryRaw`
            SELECT l.dono_id AS dono_id, l.convenio AS convenio, COUNT(DISTINCT l.cpf) AS n
            FROM leads_importados l
            WHERE l.dono_id = ${req.donoId}
              AND l.cpf IN (
                SELECT cpf FROM leads_importados
                WHERE dono_id = ${req.donoId} AND cpf IS NOT NULL
                GROUP BY cpf HAVING COUNT(DISTINCT convenio) > 1
              )
            GROUP BY l.dono_id, l.convenio`,
    ]);

    const idsImp = [...new Set(importacoes.map((i) => i.criadorId).filter(Boolean))];
    const importadores = idsImp.length
      ? await prisma.usuario.findMany({ where: { id: { in: idsImp } }, select: { id: true, nome: true } })
      : [];
    const nomeImp = new Map(importadores.map((u) => [u.id, u.nome]));

    for (const i of importacoes) {
      const c = cartoes.get(chave(i.donoId, i.convenio));
      if (!c) continue;
      c.importacoes += 1;
      const nome = nomeImp.get(i.criadorId);
      if (nome && !c.importadores.includes(nome)) c.importadores.push(nome);
    }
    for (const m of multi) {
      const c = cartoes.get(chave(m.dono_id, m.convenio));
      if (c) c.multiConvenio = numero(m.n);
    }
  }

  const agora = Date.now();
  const itens = [...cartoes.entries()]
    .filter(([k]) => !convenioPermitidos || convenioPermitidos.has(k))
    .map(([, c]) => ({
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
  const desloca = (pagina - 1) * limite;

  const [linhas, total] = await Promise.all([
    ehMaster(req)
      ? prisma.$queryRaw`
          SELECT cpf, MIN(nome) AS nome, COUNT(DISTINCT convenio) AS convenios_n,
                 GROUP_CONCAT(DISTINCT COALESCE(convenio, '(sem convênio)') SEPARATOR '||') AS convenios
          FROM leads_importados
          WHERE cpf IS NOT NULL
          GROUP BY dono_id, cpf HAVING COUNT(DISTINCT convenio) > 1
          ORDER BY convenios_n DESC, nome ASC
          LIMIT ${limite} OFFSET ${desloca}`
      : prisma.$queryRaw`
          SELECT cpf, MIN(nome) AS nome, COUNT(DISTINCT convenio) AS convenios_n,
                 GROUP_CONCAT(DISTINCT COALESCE(convenio, '(sem convênio)') SEPARATOR '||') AS convenios
          FROM leads_importados
          WHERE dono_id = ${donoId} AND cpf IS NOT NULL
          GROUP BY cpf HAVING COUNT(DISTINCT convenio) > 1
          ORDER BY convenios_n DESC, nome ASC
          LIMIT ${limite} OFFSET ${desloca}`,
    contarDuplicados(req),
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
