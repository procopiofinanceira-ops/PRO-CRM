import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';
import { cifrar, decifrar } from '../lib/assistente/cripto.js';
import { chamarProvedor, PROVEDORES, provedorValido } from '../lib/assistente/provedores.js';
import { montarInstrucoes } from '../lib/assistente/guia.js';

const router = Router();
router.use(autenticar);

const MAX_PERGUNTA = 2000;
const MAX_HISTORICO = 12;
const MAX_TEXTO_HISTORICO = 4000;
const MAX_EXTRAS = 8000;

const limite = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => req.usuario.id,
  message: { erro: 'Muitas perguntas em pouco tempo. Aguarde um instante.' },
});

// ---------------- Configuração (registro único) ----------------

const chaveValida = (k) => /^[A-Za-z0-9._~+/=-]{20,300}$/.test(k);
const modeloValido = (m) => /^[a-zA-Z0-9][a-zA-Z0-9._/:-]{1,99}$/.test(m) && !m.includes('..');
const finalDaChave = (k) => k.slice(-4);

async function lerConfig() {
  const reg = await prisma.configAssistente.findUnique({ where: { id: 'padrao' } });
  const provedores = reg?.provedores && typeof reg.provedores === 'object' ? reg.provedores : {};
  return {
    provedor: provedorValido(reg?.provedor),
    ativo: reg ? reg.ativo : true,
    instrucoesExtras: reg?.instrucoesExtras ?? '',
    provedores,
    atualizadoEm: reg?.atualizadoEm ?? null,
  };
}

/** Dados de um provedor prontos para uso (chave decifrada). */
function dadosDoProvedor(config, id) {
  const p = config.provedores[id] ?? {};
  const apiKey = p.chaveCifrada ? decifrar(p.chaveCifrada) : null;
  return {
    apiKey,
    chaveIlegivel: Boolean(p.chaveCifrada) && !apiKey,
    final: p.final ?? '',
    modelo: p.modelo && modeloValido(p.modelo) ? p.modelo : PROVEDORES[id].modeloPadrao,
  };
}

/** O que a tela de configuração recebe. Nunca inclui a chave. */
function resumo(config) {
  const provedores = {};
  for (const id of Object.keys(PROVEDORES)) {
    const d = dadosDoProvedor(config, id);
    provedores[id] = {
      nome: PROVEDORES[id].nome,
      configurado: Boolean(d.apiKey),
      chaveIlegivel: d.chaveIlegivel,
      final: d.final,
      modelo: d.modelo,
      modeloPadrao: PROVEDORES[id].modeloPadrao,
    };
  }
  return {
    provedor: config.provedor,
    ativo: config.ativo,
    instrucoesExtras: config.instrucoesExtras,
    atualizadoEm: config.atualizadoEm,
    provedores,
  };
}

// ---------------- Rotas para qualquer usuário ----------------

router.get('/status', async (_req, res) => {
  const config = await lerConfig();
  const { apiKey } = dadosDoProvedor(config, config.provedor);
  res.json({ disponivel: config.ativo && Boolean(apiKey) });
});

const perguntaSchema = z.object({
  pergunta: z.string().trim().min(1, 'Escreva a sua pergunta.').max(MAX_PERGUNTA, `A pergunta pode ter até ${MAX_PERGUNTA} caracteres.`),
  historico: z
    .array(z.object({ role: z.enum(['user', 'assistant']), texto: z.string().max(MAX_TEXTO_HISTORICO) }))
    .max(MAX_HISTORICO)
    .default([]),
});

router.post('/perguntar', limite, async (req, res) => {
  const dados = perguntaSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const config = await lerConfig();
  if (!config.ativo) return res.status(503).json({ erro: 'O assistente está desativado.', codigo: 'DESATIVADO' });

  const { apiKey, chaveIlegivel, modelo } = dadosDoProvedor(config, config.provedor);
  if (!apiKey) {
    return res.status(503).json({
      erro: chaveIlegivel
        ? 'A chave salva do assistente não pôde ser lida. O master precisa informá-la de novo.'
        : 'O assistente ainda não foi configurado pelo master.',
      codigo: 'NAO_CONFIGURADO',
    });
  }

  // O histórico precisa começar por uma fala do usuário e alternar papéis
  const historico = dados.data.historico.filter((m) => m.texto.trim());
  while (historico.length && historico[0].role !== 'user') historico.shift();
  const conversa = [];
  for (const m of [...historico, { role: 'user', texto: dados.data.pergunta }]) {
    if (conversa.length && conversa.at(-1).role === m.role) conversa.at(-1).texto += `\n${m.texto}`;
    else conversa.push({ ...m });
  }

  try {
    const { texto } = await chamarProvedor({
      provedor: config.provedor,
      apiKey,
      modelo,
      instrucoes: montarInstrucoes({ usuario: req.usuario, extras: config.instrucoesExtras }),
      conversa,
    });
    res.json({ resposta: texto });
  } catch (e) {
    if (!e.codigo) throw e;
    console.error(`[Assistente] ${config.provedor} (${modelo}): ${e.codigo} ${e.detalhe ?? ''}`);
    res.status(e.status).json({ erro: e.message, codigo: e.codigo });
  }
});

// ---------------- Configuração: só master ----------------

router.get('/config', exigirPerfil('MASTER'), async (_req, res) => res.json(resumo(await lerConfig())));

const configSchema = z.object({
  provedor: z.enum(Object.keys(PROVEDORES)).optional(),
  ativo: z.boolean().optional(),
  instrucoesExtras: z.string().max(MAX_EXTRAS, `As orientações podem ter até ${MAX_EXTRAS} caracteres.`).optional(),
  // Chave nova por provedor; vazio ou ausente = mantém a salva
  chaves: z.record(z.string()).optional(),
  modelos: z.record(z.string()).optional(),
  removerChaves: z.array(z.string()).optional(),
});

router.put('/config', exigirPerfil('MASTER'), async (req, res) => {
  const dados = configSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: dados.error.issues[0].message });

  const { chaves = {}, modelos = {}, removerChaves = [] } = dados.data;
  const atual = await lerConfig();
  const provedores = JSON.parse(JSON.stringify(atual.provedores));

  for (const id of Object.keys(PROVEDORES)) {
    provedores[id] ??= {};
    const chave = (chaves[id] ?? '').trim();
    if (chave) {
      if (!chaveValida(chave)) return res.status(400).json({ erro: `A chave informada para ${PROVEDORES[id].nome} parece inválida.` });
      provedores[id].chaveCifrada = cifrar(chave);
      provedores[id].final = finalDaChave(chave);
    }
    if (removerChaves.includes(id)) {
      delete provedores[id].chaveCifrada;
      delete provedores[id].final;
    }
    if (id in modelos) {
      const modelo = modelos[id].trim();
      if (modelo && !modeloValido(modelo)) return res.status(400).json({ erro: `Modelo inválido para ${PROVEDORES[id].nome}.` });
      if (modelo) provedores[id].modelo = modelo;
      else delete provedores[id].modelo;
    }
  }

  const data = {
    provedor: dados.data.provedor ?? atual.provedor,
    ativo: dados.data.ativo ?? atual.ativo,
    instrucoesExtras: (dados.data.instrucoesExtras ?? atual.instrucoesExtras).trim() || null,
    provedores,
    atualizadoPorId: req.usuario.id,
  };
  await prisma.configAssistente.upsert({ where: { id: 'padrao' }, update: data, create: { id: 'padrao', ...data } });
  res.json(resumo(await lerConfig()));
});

// Usa a chave já salva do provedor escolhido para uma pergunta simples
router.post('/config/testar', exigirPerfil('MASTER'), limite, async (req, res) => {
  const id = provedorValido(req.body?.provedor);
  const config = await lerConfig();
  const { apiKey, chaveIlegivel, modelo } = dadosDoProvedor(config, id);
  if (!apiKey) {
    return res.status(400).json({ erro: chaveIlegivel ? 'A chave salva não pôde ser lida. Informe-a de novo.' : 'Salve uma chave para este provedor antes de testar.' });
  }
  try {
    const { texto } = await chamarProvedor({
      provedor: id,
      apiKey,
      modelo,
      instrucoes: 'Responda apenas com a palavra OK.',
      conversa: [{ role: 'user', texto: 'Teste de conexão.' }],
      maxTokens: 20,
    });
    res.json({ ok: true, modelo, resposta: texto.slice(0, 100) });
  } catch (e) {
    if (!e.codigo) throw e;
    // O master pode ver o motivo informado pelo provedor (sem a chave)
    res.status(e.status).json({ erro: e.message, codigo: e.codigo, detalhe: e.detalhe });
  }
});

export default router;
