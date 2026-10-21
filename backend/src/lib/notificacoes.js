import { prisma } from './prisma.js';

/**
 * Registra uma notificação para a equipe (dono) e, opcionalmente, para um usuário.
 * Nunca lança erro: falha em notificar não pode quebrar a ação principal.
 */
export async function criarNotificacao({ donoId, usuarioId = null, tipo, titulo, mensagem = null }) {
  try {
    await prisma.notificacao.create({ data: { donoId, usuarioId, tipo, titulo, mensagem } });
  } catch (e) {
    console.error('Falha ao criar notificação:', e.message);
  }
}
