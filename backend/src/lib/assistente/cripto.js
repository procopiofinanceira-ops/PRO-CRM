import crypto from 'node:crypto';

// As chaves de API dos provedores de IA ficam no banco cifradas (AES-256-GCM).
// A chave de cifragem vem de ASSISTENTE_CHAVE (64 caracteres hexadecimais). Se não existir,
// deriva-se uma do JWT_SECRET, mas então trocar o JWT_SECRET invalida as chaves salvas.

let chaveCache;

function chave() {
  if (chaveCache) return chaveCache;
  const env = process.env.ASSISTENTE_CHAVE;
  if (env && /^[0-9a-f]{64}$/i.test(env)) {
    chaveCache = Buffer.from(env, 'hex');
  } else {
    if (env) console.warn('ASSISTENTE_CHAVE inválida (esperado: 64 caracteres hexadecimais); usando chave derivada.');
    chaveCache = Buffer.from(crypto.hkdfSync('sha256', process.env.JWT_SECRET, 'procrm', 'assistente-chaves', 32));
  }
  return chaveCache;
}

export function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([cifra.update(String(texto), 'utf8'), cifra.final()]);
  return ['v1', iv.toString('base64'), cifra.getAuthTag().toString('base64'), dados.toString('base64')].join(':');
}

/** Devolve o texto original ou null se não for possível decifrar (chave mudou, dado corrompido). */
export function decifrar(valor) {
  try {
    const [versao, iv, tag, dados] = String(valor).split(':');
    if (versao !== 'v1') return null;
    const decifra = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64'));
    decifra.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decifra.update(Buffer.from(dados, 'base64')), decifra.final()]).toString('utf8');
  } catch {
    return null;
  }
}
