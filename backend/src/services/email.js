import nodemailer from 'nodemailer';

let transporter = null;

function smtpConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function enviarCodigoOtp(email, codigo) {
  if (!smtpConfigurado()) {
    // Sem SMTP: só em desenvolvimento o código aparece no terminal.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP não configurado em produção.');
    }
    console.log(`[DEV] Código de verificação para ${email}: ${codigo}`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'PRO-CRM: seu código de verificação',
    text: `Seu código de verificação é ${codigo}. Ele expira em 10 minutos.`,
  });
}
