import { prisma } from './prisma.js';

// As bases importadas pelo master são de todos: aparecem na tela Bases de qualquer equipe.
// Para as demais equipes, entra só o que está sem responsável (a fila de onde se escolhe quem trabalhar).

let masters = [];

export async function carregarMasters() {
  const lista = await prisma.usuario.findMany({ where: { perfil: 'MASTER', ativo: true }, select: { id: true } });
  masters = lista.map((u) => u.id);
}

carregarMasters().catch((e) => console.error('Não foi possível carregar os masters:', e.message));
setInterval(() => carregarMasters().catch(() => {}), 60_000).unref();

/**
 * Onde o usuário enxerga leads para leitura (listar, contar, escolher para trabalhar).
 * O master enxerga as bases de todas as equipes; para escolher clientes para trabalhar
 * (paraTrabalhar), vale só o que é dele: as bases das equipes são só para consulta.
 */
export function escopoLeitura(req, { paraTrabalhar = false } = {}) {
  const donoId = req.donoId;
  if (req.usuario.perfil === 'MASTER') return paraTrabalhar ? { donoId } : {};
  const compartilhados = masters.filter((id) => id !== donoId);
  if (req.usuario.perfil === 'PROMOTOR') {
    // Os dele e a fila sem responsável (da equipe e das bases do master)
    return { AND: [{ OR: [{ donoId, funcionarioId: req.usuario.id }, { donoId: { in: [donoId, ...compartilhados] }, funcionarioId: null }] }] };
  }
  if (!compartilhados.length) return { donoId };
  return { AND: [{ OR: [{ donoId }, { donoId: { in: compartilhados }, funcionarioId: null }] }] };
}
