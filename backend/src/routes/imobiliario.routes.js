import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { txt, data, num } from '../lib/crud.js';
import { autenticar } from '../middleware/auth.js';
import { criarNotificacao } from '../lib/notificacoes.js';
import { configSimuladores, simularFinanciamento, simularHomeEquity } from '../lib/simulador.js';

const router = Router();
router.use(autenticar);

export const BANCOS_IMOB = [
  'Itaú', 'Santander', 'Bari', 'Credita', 'Cashme', 'Ponte', 'Tcash', 'Inter', 'Bradesco', 'C6', 'Daycoval',
];
const STATUS_BANCO = ['enviado', 'aprovado', 'reprovado', 'em_analise'];

// Promotor só enxerga as propostas que ele criou, salvo permissão específica
const veTodas = (u) => u.perfil !== 'PROMOTOR' || (Array.isArray(u.permissoes) && u.permissoes.includes('imob_ver_todas'));
const escopo = (req) => ({ donoId: req.donoId, ...(veTodas(req.usuario) ? {} : { criadorId: req.usuario.id }) });

const INCLUIR = {
  bancos: { orderBy: { banco: 'asc' } },
  documentos: { select: { id: true, nome: true, mimeType: true, tamanho: true, criadoEm: true }, orderBy: { criadoEm: 'desc' } },
};

// ---------------- Propostas ----------------

const propostaSchema = z.object({
  produto: z.enum(['Aquisição', 'Home Equity']).optional(),
  parceiro: txt,
  consultor: txt,
  dataInicio: data,
  portal: txt,
  proposta: txt,
  aprovacao: txt,
  agendamento: data,
  documento: txt,
  modalidade: txt,
  acao: txt,
  etapa: z.string().trim().min(1).optional(),
  observacao1: txt,
  observacao2: txt,
  cliente: z.string().trim().min(2, 'Informe o nome do cliente.'),
  cpf: txt,
  contato: txt,
  emailCliente: txt,
  dataNascimento: data,
  cidade: txt,
  habitantes: txt,
  situacaoProfissional: txt,
  estadoCivil: txt,
  rendaPrincipal: txt,
  rendaMensal: num,
  rendaFamiliar: num,
  conjugeNome: txt,
  conjugeEmail: txt,
  conjugeCelular: txt,
  conjugeCpf: txt,
  conjugeNascimento: data,
  conjugeRenda: num,
  valorImovel: num,
  valorFinanciamentoLiq: num,
  valorNecessario: num,
  prazoPretendido: txt,
  analiseCreditoStatus: txt,
  numeroImovel: txt,
  cepImovel: txt,
  complementoImovel: txt,
  tipoImovelGarantia: txt,
  pagandoImovel: txt,
  matriculaImovel: txt,
  bancos: z
    .array(
      z.object({
        banco: z.enum(BANCOS_IMOB),
        status: z.enum(STATUS_BANCO).nullable().optional(),
        valorAprovado: num,
      }),
    )
    .optional(),
});

async function gravarBancos(tx, propostaId, bancos) {
  await tx.imobPropostaBanco.deleteMany({ where: { propostaId } });
  const linhas = bancos.filter((b) => b.status || b.valorAprovado != null);
  if (linhas.length) {
    await tx.imobPropostaBanco.createMany({
      data: linhas.map((b) => ({
        propostaId,
        banco: b.banco,
        status: b.status ?? null,
        valorAprovado: b.valorAprovado ?? null,
      })),
    });
  }
}

router.get('/propostas', async (req, res) => {
  const where = escopo(req);
  const q = String(req.query.q ?? '').trim();
  if (q) where.OR = [{ cliente: { contains: q } }, { cpf: { contains: q } }, { parceiro: { contains: q } }];
  if (req.query.etapa) where.etapa = String(req.query.etapa);

  const itens = await prisma.imobProposta.findMany({
    where,
    include: INCLUIR,
    orderBy: { atualizadoEm: 'desc' },
    take: 500,
  });
  res.json({ itens });
});

router.post('/propostas', async (req, res) => {
  const dados = propostaSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const { bancos, ...resto } = dados.data;
  const item = await prisma.$transaction(async (tx) => {
    const criada = await tx.imobProposta.create({
      data: { ...resto, donoId: req.donoId, criadorId: req.usuario.id, etapaAtualizadaEm: new Date() },
    });
    if (bancos) await gravarBancos(tx, criada.id, bancos);
    return tx.imobProposta.findUnique({ where: { id: criada.id }, include: INCLUIR });
  });

  criarNotificacao({
    donoId: req.donoId,
    tipo: 'nova_proposta_imob',
    titulo: 'Nova proposta imobiliária',
    mensagem: `${req.usuario.nome} cadastrou uma proposta para ${item.cliente}.`,
  });
  res.status(201).json({ item });
});

router.put('/propostas/:id', async (req, res) => {
  const dados = propostaSchema.partial().safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const atual = await prisma.imobProposta.findFirst({ where: { id: req.params.id, ...escopo(req) } });
  if (!atual) return res.status(404).json({ erro: 'Proposta não encontrada.' });

  const { bancos, ...resto } = dados.data;
  const etapaMudou = resto.etapa && resto.etapa !== atual.etapa;
  if (etapaMudou) resto.etapaAtualizadaEm = new Date();

  const item = await prisma.$transaction(async (tx) => {
    await tx.imobProposta.update({ where: { id: atual.id }, data: resto });
    if (bancos) await gravarBancos(tx, atual.id, bancos);
    return tx.imobProposta.findUnique({ where: { id: atual.id }, include: INCLUIR });
  });

  if (etapaMudou) {
    criarNotificacao({
      donoId: req.donoId,
      tipo: 'etapa_proposta_imob',
      titulo: 'Etapa da proposta atualizada',
      mensagem: `${item.cliente}: ${atual.etapa ?? 'sem etapa'} → ${item.etapa}`,
    });
  }
  res.json({ item });
});

router.delete('/propostas/:id', async (req, res) => {
  const atual = await prisma.imobProposta.findFirst({
    where: { id: req.params.id, ...escopo(req) },
    include: { documentos: true },
  });
  if (!atual) return res.status(404).json({ erro: 'Proposta não encontrada.' });

  await prisma.imobProposta.delete({ where: { id: atual.id } });
  for (const doc of atual.documentos) apagarArquivo(doc.caminho);

  criarNotificacao({
    donoId: req.donoId,
    tipo: 'exclusao_proposta_imob',
    titulo: 'Proposta imobiliária excluída',
    mensagem: `${req.usuario.nome} excluiu a proposta de ${atual.cliente ?? 'cliente não informado'}.`,
  });
  res.json({ ok: true });
});

// ---------------- Documentos ----------------

const PASTA_DOCS = path.resolve(process.env.UPLOADS_DIR || 'uploads', 'imob');
fs.mkdirSync(PASTA_DOCS, { recursive: true });

const TIPOS_PERMITIDOS = new Map([
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PASTA_DOCS),
    // Nome aleatório no disco: o nome original só existe no banco
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (TIPOS_PERMITIDOS.has(ext)) return cb(null, true);
    const erro = new Error('Tipo de arquivo não permitido. Use PDF, imagem, Word ou Excel.');
    erro.status = 400;
    cb(erro);
  },
});

function apagarArquivo(caminho) {
  try {
    // Só apaga dentro da pasta de documentos
    const abs = path.resolve(caminho);
    if (abs.startsWith(PASTA_DOCS + path.sep)) fs.unlinkSync(abs);
  } catch {
    /* arquivo já removido */
  }
}

async function buscarProposta(req, res, next) {
  const proposta = await prisma.imobProposta.findFirst({ where: { id: req.params.id, ...escopo(req) } });
  if (!proposta) return res.status(404).json({ erro: 'Proposta não encontrada.' });
  req.proposta = proposta;
  next();
}

router.post(
  '/propostas/:id/documentos',
  buscarProposta,
  (req, res, next) =>
    upload.single('arquivo')(req, res, (err) => {
      if (!err) return next();
      const status = err.status ?? (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
      const erro = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 20 MB.' : err.message;
      res.status(status).json({ erro });
    }),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Envie um arquivo.' });

    // Nome vindo do navegador pode estar em latin1; corrige acentos
    const nomeOriginal = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const item = await prisma.imobDocumento.create({
      data: {
        propostaId: req.proposta.id,
        donoId: req.donoId,
        nome: nomeOriginal,
        nomeOriginal,
        mimeType: TIPOS_PERMITIDOS.get(path.extname(req.file.filename).toLowerCase()),
        tamanho: req.file.size,
        caminho: req.file.path,
      },
      select: { id: true, nome: true, mimeType: true, tamanho: true, criadoEm: true },
    });
    criarNotificacao({
      donoId: req.donoId,
      tipo: 'documento_proposta_imob',
      titulo: 'Documento anexado à proposta',
      mensagem: `${req.usuario.nome} enviou "${nomeOriginal}" na proposta de ${req.proposta.cliente ?? 'cliente'}.`,
    });
    res.status(201).json({ item });
  },
);

async function buscarDocumento(req, res, next) {
  const doc = await prisma.imobDocumento.findFirst({
    where: { id: req.params.id, donoId: req.donoId },
    include: { proposta: { select: { criadorId: true } } },
  });
  if (!doc || (!veTodas(req.usuario) && doc.proposta.criadorId !== req.usuario.id)) {
    return res.status(404).json({ erro: 'Documento não encontrado.' });
  }
  req.documento = doc;
  next();
}

router.get('/documentos/:id/download', buscarDocumento, (req, res) => {
  const abs = path.resolve(req.documento.caminho);
  if (!abs.startsWith(PASTA_DOCS + path.sep) || !fs.existsSync(abs)) {
    return res.status(404).json({ erro: 'Arquivo indisponível.' });
  }
  res.download(abs, req.documento.nomeOriginal);
});

router.delete('/documentos/:id', buscarDocumento, async (req, res) => {
  await prisma.imobDocumento.delete({ where: { id: req.documento.id } });
  apagarArquivo(req.documento.caminho);
  res.json({ ok: true });
});

// ---------------- Controle de promotores ----------------

const soGestao = (req, res, next) =>
  req.usuario.perfil === 'PROMOTOR' ? res.status(403).json({ erro: 'Acesso negado.' }) : next();

router.get('/promotores', soGestao, async (req, res) => {
  const propostas = await prisma.imobProposta.findMany({
    where: { donoId: req.donoId },
    select: { criadorId: true, etapa: true, valorFinanciamentoLiq: true, criadoEm: true },
  });

  const ids = [...new Set(propostas.map((p) => p.criadorId).filter(Boolean))];
  const usuarios = ids.length
    ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
    : [];
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));

  const mapa = new Map();
  for (const p of propostas) {
    const chave = p.criadorId ?? 'sem';
    const g =
      mapa.get(chave) ??
      { criadorId: p.criadorId, nome: p.criadorId ? nomes.get(p.criadorId) ?? 'Usuário removido' : 'Sem criador',
        total: 0, valorTotal: 0, porEtapa: {}, ultimaAtividade: p.criadoEm };
    g.total += 1;
    g.valorTotal += Number(p.valorFinanciamentoLiq ?? 0);
    const etapa = p.etapa ?? 'Proposta criada';
    g.porEtapa[etapa] = (g.porEtapa[etapa] ?? 0) + 1;
    if (p.criadoEm > g.ultimaAtividade) g.ultimaAtividade = p.criadoEm;
    mapa.set(chave, g);
  }
  res.json({ itens: [...mapa.values()].sort((a, b) => b.total - a.total) });
});

router.get('/promotores/:criadorId/propostas', soGestao, async (req, res) => {
  const itens = await prisma.imobProposta.findMany({
    where: { donoId: req.donoId, criadorId: req.params.criadorId === 'sem' ? null : req.params.criadorId },
    include: INCLUIR,
    orderBy: { atualizadoEm: 'desc' },
  });
  res.json({ itens });
});

// ---------------- Simulações ----------------

router.get('/simulacoes/config', (_req, res) => res.json(configSimuladores()));

const taxasSchema = z.record(z.coerce.number().positive().max(100)).optional();
const comum = {
  valorImovel: z.coerce.number().positive('Informe o valor do imóvel.'),
  prazo: z.coerce.number().int().min(12).max(480),
  sistema: z.enum(['SAC', 'PRICE']),
  taxas: taxasSchema,
  tipoImovel: z.string().trim().optional(),
  cpf: z.string().trim().optional(),
  cliente: z.string().trim().optional(),
  dataNascimento: z.string().trim().optional(),
};

const simulacaoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('financiamento_imobiliario'),
    ...comum,
    valorFinanciado: z.coerce.number().positive('Informe o valor a financiar.'),
    incluirDespesas: z.boolean().default(false),
  }),
  z.object({
    tipo: z.literal('home_equity'),
    ...comum,
    valorEmprestimo: z.coerce.number().positive('Informe o valor do empréstimo.'),
    incluirAvaliacao: z.boolean().default(true),
    incluirIOF: z.boolean().default(true),
  }),
]);

function executarSimulacao(d) {
  return d.tipo === 'home_equity' ? simularHomeEquity(d) : simularFinanciamento(d);
}

router.post('/simulacoes/calcular', (req, res) => {
  const dados = simulacaoSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });
  res.json({ resultado: executarSimulacao(dados.data) });
});

router.get('/simulacoes', async (req, res) => {
  const itens = await prisma.imobSimulacao.findMany({
    where: { donoId: req.donoId },
    orderBy: { criadoEm: 'desc' },
    take: 200,
  });
  res.json({ itens });
});

// O resultado é sempre recalculado no servidor, nunca aceito do cliente
router.post('/simulacoes', async (req, res) => {
  const dados = simulacaoSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const item = await prisma.imobSimulacao.create({
    data: {
      donoId: req.donoId,
      tipo: dados.data.tipo,
      criadorNome: req.usuario.nome,
      dados: dados.data,
      resultado: executarSimulacao(dados.data),
    },
  });
  criarNotificacao({
    donoId: req.donoId,
    tipo: 'simulacao_imob',
    titulo: 'Nova simulação imobiliária',
    mensagem: `${req.usuario.nome} salvou uma simulação de ${item.tipo === 'home_equity' ? 'home equity' : 'financiamento'}.`,
  });
  res.status(201).json({ item });
});

router.delete('/simulacoes/:id', async (req, res) => {
  const r = await prisma.imobSimulacao.deleteMany({ where: { id: req.params.id, donoId: req.donoId } });
  if (!r.count) return res.status(404).json({ erro: 'Simulação não encontrada.' });
  res.json({ ok: true });
});

export default router;
