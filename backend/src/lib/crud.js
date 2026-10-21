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
 * escopoExtra    (req) => filtro adicional (ex.: promotor só vê o que é dele)
 * aoCriar        (req, dados) => dados  (acrescenta campos antes de gravar)
 * aoAtualizar    (req, dados, atual) => dados
 */
export function criarCrud({ model, schema, busca = [], filtros = [], ordem, incluir, escopoExtra, aoCriar, aoAtualizar }) {
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

    const limite = Math.min(Number(req.query.limite) || 500, 1000);
    const itens = await db().findMany({ where, orderBy: ordem, include: incluir, take: limite });
    res.json({ itens });
  });

  router.get('/:id', async (req, res) => {
    const item = await db().findFirst({ where: { id: req.params.id, ...base(req) }, include: incluir });
    if (!item) return res.status(404).json({ erro: 'Registro não encontrado.' });
    res.json({ item });
  });

  router.post('/', async (req, res) => {
    const dados = schema.safeParse(req.body);
    if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

    const payload = aoCriar ? aoCriar(req, dados.data) : dados.data;
    const item = await db().create({ data: { ...payload, donoId: req.donoId }, include: incluir });
    res.status(201).json({ item });
  });

  router.put('/:id', async (req, res) => {
    const dados = schema.partial().safeParse(req.body);
    if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

    const atual = await db().findFirst({ where: { id: req.params.id, ...base(req) } });
    if (!atual) return res.status(404).json({ erro: 'Registro não encontrado.' });

    const payload = aoAtualizar ? aoAtualizar(req, dados.data, atual) : dados.data;
    const item = await db().update({ where: { id: atual.id }, data: payload, include: incluir });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const atual = await db().findFirst({ where: { id: req.params.id, ...base(req) } });
    if (!atual) return res.status(404).json({ erro: 'Registro não encontrado.' });

    await db().delete({ where: { id: atual.id } });
    res.json({ ok: true });
  });

  return router;
}
