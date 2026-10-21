// Chamadas aos provedores de IA. Todas devolvem { texto } ou lançam um erro com
// { status, codigo, erro, detalhe } já em linguagem de gente (nunca contém a chave).

const TEMPO_LIMITE_MS = 50_000;

export const PROVEDORES = {
  anthropic: {
    nome: 'Claude (Anthropic)',
    modeloPadrao: 'claude-haiku-5-5',
    url: () => process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
  },
  gemini: {
    nome: 'Gemini (Google)',
    modeloPadrao: 'gemini-flash-latest',
    url: () => process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  },
  grok: {
    nome: 'Grok (xAI)',
    modeloPadrao: 'grok-4.20-0309-non-reasoning',
    url: () => process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
  },
  groq: {
    nome: 'Groq',
    modeloPadrao: 'llama-3.3-70b-versatile',
    url: () => process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  },
};

export const provedorValido = (p) => (p in PROVEDORES ? p : 'anthropic');

class ErroProvedor extends Error {
  constructor({ status, codigo, erro, detalhe }) {
    super(erro);
    Object.assign(this, { status, codigo, detalhe });
  }
}

const mensagemDoCorpo = (corpo) => {
  const e = corpo?.error;
  return String((typeof e === 'string' ? e : e?.message) || corpo?.message || corpo?.detail || '');
};

function erroHttp(provedor, status, corpo, apiKey) {
  const nome = PROVEDORES[provedor].nome;
  const detalhe = mensagemDoCorpo(corpo).split(apiKey).join('[chave]').replace(/\s+/g, ' ').trim().slice(0, 300);
  const base = { detalhe };

  if (status === 401 || (status === 400 && /api[ _-]?key/i.test(detalhe))) {
    return new ErroProvedor({ ...base, status: 502, codigo: 'CHAVE_INVALIDA', erro: `A chave de API do ${nome} é inválida. Confira em Configurações → Assistente.` });
  }
  if (status === 403) {
    return new ErroProvedor({ ...base, status: 502, codigo: 'SEM_PERMISSAO', erro: `A chave do ${nome} não tem permissão para usar a API, ou a conta está sem créditos.` });
  }
  if (status === 404) {
    return new ErroProvedor({ ...base, status: 502, codigo: 'MODELO_INVALIDO', erro: `O modelo configurado para o ${nome} não existe ou não está disponível para esta chave.` });
  }
  if (status === 429 || status === 413) {
    return new ErroProvedor({ ...base, status: 503, codigo: 'COTA', erro: `O limite de uso da API do ${nome} foi atingido. Tente de novo em alguns minutos.` });
  }
  if (status >= 500) {
    return new ErroProvedor({ ...base, status: 503, codigo: 'PROVEDOR_FORA', erro: `O ${nome} está indisponível agora. Tente de novo em instantes.` });
  }
  return new ErroProvedor({ ...base, status: 502, codigo: 'PROVEDOR_ERRO', erro: `O ${nome} recusou o pedido. Tente reformular a pergunta.` });
}

async function requisitar(provedor, apiKey, url, init) {
  const nome = PROVEDORES[provedor].nome;
  let resp;
  try {
    resp = await fetch(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch (e) {
    const tempo = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new ErroProvedor(
      tempo
        ? { status: 504, codigo: 'TEMPO', erro: `O ${nome} demorou demais para responder. Tente de novo.` }
        : { status: 503, codigo: 'PROVEDOR_FORA', erro: `Não foi possível falar com o ${nome} agora. Tente de novo em instantes.` },
    );
  }
  const corpo = await resp.json().catch(() => null);
  if (!resp.ok) throw erroHttp(provedor, resp.status, corpo, apiKey);
  return corpo;
}

const SEM_RESPOSTA = (provedor) =>
  new ErroProvedor({ status: 422, codigo: 'SEM_RESPOSTA', erro: `O ${PROVEDORES[provedor].nome} não respondeu a essa pergunta. Tente perguntar de outro jeito.` });

const limitar = (texto) => String(texto ?? '').trim();

/**
 * conversa: [{ role: 'user' | 'assistant', texto }] (a última é do usuário).
 */
export async function chamarProvedor({ provedor, apiKey, modelo, instrucoes, conversa, maxTokens = 1500 }) {
  const base = PROVEDORES[provedor].url();

  if (provedor === 'anthropic') {
    const corpo = await requisitar(provedor, apiKey, `${base}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: modelo,
        max_tokens: maxTokens,
        system: instrucoes,
        messages: conversa.map((m) => ({ role: m.role, content: m.texto })),
      }),
    });
    const texto = limitar(corpo?.content?.filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
    if (!texto) throw SEM_RESPOSTA(provedor);
    return { texto };
  }

  if (provedor === 'gemini') {
    const corpo = await requisitar(provedor, apiKey, `${base}/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucoes }] },
        contents: conversa.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.texto }] })),
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      }),
    });
    const texto = limitar(corpo?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join(''));
    if (!texto) throw SEM_RESPOSTA(provedor);
    return { texto };
  }

  // Grok e Groq falam o formato "OpenAI"
  const corpo = await requisitar(provedor, apiKey, `${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelo,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: instrucoes }, ...conversa.map((m) => ({ role: m.role, content: m.texto }))],
    }),
  });
  const texto = limitar(corpo?.choices?.[0]?.message?.content);
  if (!texto) throw SEM_RESPOSTA(provedor);
  return { texto };
}
