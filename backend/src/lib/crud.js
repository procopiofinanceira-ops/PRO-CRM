import { Router } from 'express';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { autenticar } from '../middleware/auth.js';

// ---------- helpers de validação ----------

/** Texto opcional: "" vira null; ausente continua ausente (não apaga na edição). */
export const txt = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

/** Data opcional: aceita ISO, "" (vira null) ou null. */
export const data = z
  .union([z.null(), z.literal(''), z.coerce.date()])
  .optional()
  .transform((v) => (v === '' ? null : v));

/** Número opcional (valores em reais etc.). */
export const num = z
  .union([z.null(), z.literal(''), z.coerce.number()])
  .optional()
  .transform((v) => (v === '' ? null : v));

// ---------- erros com status HTTP ----------

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/** Lance dentro de aoCriar/aoAtualizar para responder com um status específico (ex.: 400). */
export const erroHttp = (status, mensagem) => new ErroHttp(status, mensagem);

const responderErro = (res, e) => {
  if (e instanceof ErroHttp) return res.status(e.status).json({ erro: e.message });
  throw e;
};

// ---------- fábrica de CRUD ----------

/**
 * Gera um CRUD protegido, sempre filtrado pelo dono (equipe) do usuário logado.
 *
 * model          nome do model no Prisma (ex.: 'contato')
 * schema         zod object com os campos editáveis
 * busca          campos de texto pesquisados pelo parâmetro ?q=
 * ordem          orderBy padrão
 * incluir        include do Prisma
 * filtros        campos que podem ser filtrados por igualdade via query string (?tipo=X)
 * filtrosTexto   campos filtrados por "contém" via query string (?nome=ana), um por campo
 * aposSalvar     async (req, item) => void: roda depois de criar/atualizar (falhas só vão para o log)
 * aoListar       async (req, itens) => itens: enriquece a listagem (ex.: situação vinda de outra tabela)
 * escopoExtra    (req) => filtro adicional (ex.: promotor só vê o que é dele)
 * aoCriar        (req, dados) => dados  (pode ser async; acrescenta campos antes de gravar)
 * aoAtualizar    (req, dados, atual) => dados  (pode ser async; lance erroHttp para recusar)
 */
export function criarCrud({ model, schema, busca = [], filtros = [], filtrosTexto = [], ordem, incluir, escopoExtra, aoListar, aoCriar, aoAtualizar, aposSalvar }) {
  const depois = async (req, item) => {
    try {
      await aposSalvar?.(req, item);
    } catch (e) {
      console.error('aposSalvar falhou:', e.message);
    }
  };
  const router = Router();
  const db = () => prisma[model];
  const base = (req) => ({ donoId: req.donoId, ...(escopoExtra?.(req) ?? {}) });

  router.use(autenticar);

  router.get('/', async (req, res) => {
    const where = base(req);
    const q = String(req.query.q ?? '').trim();
    if (q && busca.length) where.OR = busca.map((campo) => ({ [campo]: { contains: q } }));
    for (const campo of filtros) {
      if (req.query[campo]) where[campo] = String(req.query[campo]);
    }

    for (const campo of filtrosTexto) {
      const valor = String(req.query[campo] ?? '').trim();
      if (valor) (where.AND ??= []).push({ [campo]: { contains: valor } });
    }

    const limite = Math.min(Number(req.query.limite) || 500, 1000);
    const itens = await db().findMany({ where, orderBy: ordem, include: incluir, take: limite });
    res.json({ itens: aoListar ? await aoListar(req, itens) : itens });
  });

  router.get('/:id', async (req, res) => {
    const item = await db().findFirst({ where: { id: req.params.id, ...base(req) }, include: incluir });
    if (!item) return res.status(404).json({ erro: 'Registro não encontrado.' });
    res.json({ item });
  });

  router.post('/', async (req, res) => {
    const dados = schema.safeParse(req.body);
    if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

    try {
      const payload = aoCriar ? await aoCriar(req, dados.data) : dados.data;
      const item = await db().create({ data: { ...payload, donoId: req.donoId }, include: incluir });
      await depois(req, item);
      res.status(201).json({ item });
    } catch (e) {
      responderErro(res, e);
    }
  });

  router.put('/:id', async (req, res) => {
    const dados = schema.partial().safeParse(req.body);
    if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

    const atual = await db().findFirst({ where: { id: req.params.id, ...base(req) } });
    if (!atual) return res.status(404).json({ erro: 'Registro não encontrado.' });

    try {
      const payload = aoAtualizar ? await aoAtualizar(req, dados.data, atual) : dados.data;
      const item = await db().update({ where: { id: atual.id }, data: payload, include: incluir });
      await depois(req, item);
      res.json({ item });
    } catch (e) {
      responderErro(res, e);
    }
  });

  router.delete('/:id', async (req, res) => {
    const atual = await db().findFirst({ where: { id: req.params.id, ...base(req) } });
    if (!atual) return res.status(404).json({ erro: 'Registro não encontrado.' });

    await db().delete({ where: { id: atual.id } });
    res.json({ ok: true });
  });

  return router;
}
