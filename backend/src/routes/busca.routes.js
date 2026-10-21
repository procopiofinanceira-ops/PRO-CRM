import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { autenticar } from '../middleware/auth.js';

// Busca global (paleta de comandos). Respeita o que cada perfil pode ver.

const router = Router();
router.use(autenticar);

const POR_GRUPO = 5;

router.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  if (q.length < 2) return res.json({ grupos: [] });

  const donoId = req.donoId;
  const promotor = req.usuario.perfil === 'PROMOTOR';
  const digitos = q.replace(/\D/g, '');
  const contem = (campos) => ({ OR: campos.map((c) => ({ [c]: { contains: q } })) });

  const [contatos, oportunidades, leads, propostas] = await Promise.all([
    promotor ? [] : prisma.contato.findMany({ where: { donoId, ...contem(['nome', 'email', 'telefone', 'empresa']) }, take: POR_GRUPO, select: { id: true, nome: true, empresa: true, telefone: true } }),
    prisma.oportunidade.findMany({
      where: { donoId, ...(promotor && { responsavelId: req.usuario.id }), ...contem(['nome', 'cpf', 'telefone', 'empresa']) },
      take: POR_GRUPO,
      select: { id: true, nome: true, estagio: true, empresa: true },
    }),
    prisma.leadImportado.findMany({
      where: {
        donoId,
        ...(promotor && { funcionarioId: req.usuario.id }),
        OR: [{ nome: { contains: q } }, { telefone: { contains: q } }, ...(digitos.length >= 3 ? [{ cpf: { contains: digitos } }] : [])],
      },
      take: POR_GRUPO,
      select: { id: true, nome: true, cpf: true, convenio: true },
    }),
    prisma.imobProposta.findMany({
      where: { donoId, ...(promotor && { criadorId: req.usuario.id }), ...contem(['cliente', 'cpf', 'parceiro']) },
      take: POR_GRUPO,
      select: { id: true, cliente: true, etapa: true, produto: true },
    }),
  ]);

  const grupos = [
    { grupo: 'Contatos', itens: contatos.map((c) => ({ id: c.id, titulo: c.nome, detalhe: c.empresa ?? c.telefone ?? '', rota: `/contatos?q=${encodeURIComponent(c.nome)}` })) },
    { grupo: 'Oportunidades', itens: oportunidades.map((o) => ({ id: o.id, titulo: o.nome, detalhe: o.empresa ?? o.estagio, rota: '/oportunidades' })) },
    { grupo: 'Leads', itens: leads.map((l) => ({ id: l.id, titulo: l.nome ?? l.cpf ?? 'Lead', detalhe: l.convenio ?? '', rota: `/bases?q=${encodeURIComponent(l.cpf ?? l.nome ?? '')}` })) },
    { grupo: 'Propostas imobiliárias', itens: propostas.map((p) => ({ id: p.id, titulo: p.cliente ?? 'Proposta', detalhe: [p.produto, p.etapa].filter(Boolean).join(' · '), rota: '/imobiliario' })) },
  ].filter((g) => g.itens.length);

  res.json({ grupos });
});

export default router;
