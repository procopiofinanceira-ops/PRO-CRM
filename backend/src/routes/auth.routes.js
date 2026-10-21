import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { assinarToken, gerarCodigoOtp, hashOtp } from '../lib/tokens.js';
import { USUARIO_PUBLICO } from '../lib/permissoes.js';
import { enviarCodigoOtp } from '../services/email.js';
import { autenticar } from '../middleware/auth.js';
import { travaNoLogin } from '../lib/controleAcesso.js';

const router = Router();

const OTP_VALIDADE_MS = 10 * 60 * 1000;
const OTP_MAX_TENTATIVAS = 5;
const otpAtivo = () => process.env.OTP_ENABLED !== 'false';

// Hash fixo para igualar o tempo de resposta quando o e-mail não existe
const HASH_FALSO = bcrypt.hashSync('senha-inexistente', 12);

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  senha: z.string().min(1),
});

const otpSchema = z.object({
  email: z.string().email().toLowerCase(),
  codigo: z.string().regex(/^\d{6}$/),
});

/** Finaliza o login: aplica a trava de acesso (master) e responde com o token. */
async function concluirLogin(usuario, req, res) {
  const { sid, bloqueio } = await travaNoLogin(usuario, req);
  if (bloqueio) return res.status(bloqueio.status).json({ erro: bloqueio.erro, codigo: bloqueio.codigo });

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date() },
  });
  const publico = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: USUARIO_PUBLICO,
  });
  res.json({ token: assinarToken(usuario, { sid }), usuario: publico });
}

// 1ª etapa: e-mail e senha
router.post('/login', limiteLogin, async (req, res) => {
  const dados = loginSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const { email, senha } = dados.data;
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  const senhaOk = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FALSO);
  if (!usuario || !usuario.ativo || !senhaOk) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }

  if (!otpAtivo()) {
    return concluirLogin(usuario, req, res);
  }

  const codigo = gerarCodigoOtp();
  await prisma.loginOtp.updateMany({
    where: { usuarioId: usuario.id, usado: false },
    data: { usado: true },
  });
  await prisma.loginOtp.create({
    data: {
      usuarioId: usuario.id,
      email,
      codigoHash: hashOtp(codigo),
      expiraEm: new Date(Date.now() + OTP_VALIDADE_MS),
    },
  });

  try {
    await enviarCodigoOtp(email, codigo);
  } catch (err) {
    console.error('Falha ao enviar código OTP:', err.message);
    return res.status(502).json({ erro: 'Não foi possível enviar o código por e-mail.' });
  }

  res.json({ etapa: 'otp', email });
});

// 2ª etapa: código enviado por e-mail
router.post('/verificar-otp', limiteLogin, async (req, res) => {
  const dados = otpSchema.safeParse(req.body);
  if (!dados.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const { email, codigo } = dados.data;
  const otp = await prisma.loginOtp.findFirst({
    where: { email, usado: false, expiraEm: { gt: new Date() } },
    orderBy: { criadoEm: 'desc' },
  });

  if (!otp || otp.tentativas >= OTP_MAX_TENTATIVAS) {
    return res.status(401).json({ erro: 'Código inválido ou expirado.' });
  }

  if (otp.codigoHash !== hashOtp(codigo)) {
    await prisma.loginOtp.update({
      where: { id: otp.id },
      data: { tentativas: { increment: 1 } },
    });
    return res.status(401).json({ erro: 'Código inválido ou expirado.' });
  }

  await prisma.loginOtp.update({ where: { id: otp.id }, data: { usado: true } });

  const usuario = await prisma.usuario.findUnique({ where: { id: otp.usuarioId } });
  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ erro: 'Código inválido ou expirado.' });
  }

  return concluirLogin(usuario, req, res);
});

router.get('/me', autenticar, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: USUARIO_PUBLICO,
  });
  res.json({ usuario, impersonadoPor: req.impersonadoPor ?? null });
});

const senhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres.'),
});

router.post('/alterar-senha', autenticar, async (req, res) => {
  if (req.impersonadoPor) {
    return res.status(403).json({ erro: 'Não é possível alterar a senha ao acessar o ambiente de outro usuário.' });
  }
  const dados = senhaSchema.safeParse(req.body);
  if (!dados.success) {
    return res.status(400).json({ erro: dados.error.issues[0].message });
  }

  const ok = await bcrypt.compare(dados.data.senhaAtual, req.usuario.senhaHash);
  if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta.' });

  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { senhaHash: await bcrypt.hash(dados.data.novaSenha, 12) },
  });
  res.json({ ok: true });
});

export default router;
