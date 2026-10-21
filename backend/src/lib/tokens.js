import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

/**
 * `via`: id de quem acessa o ambiente de outro usuário. `sid`: sessão única do próprio usuário.
 * `vsid`: sessão única de quem acessa em nome de outro (`via`).
 */
export function assinarToken(usuario, { via, sid, vsid } = {}) {
  const extras = { ...(via && { via }), ...(sid && { sid }), ...(vsid && { vsid }) };
  return jwt.sign({ sub: usuario.id, perfil: usuario.perfil, ...extras }, process.env.JWT_SECRET, {
    // Acesso em nome de outra pessoa dura menos
    expiresIn: via ? '4h' : process.env.JWT_EXPIRES_IN || '24h',
  });
}

export function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function gerarCodigoOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(codigo) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(codigo).digest('hex');
}
