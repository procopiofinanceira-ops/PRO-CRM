// Regras de hierarquia e permissão por perfil.

/** Perfis que cada perfil pode criar/gerenciar. */
const PODE_GERIR = {
  MASTER: ['MASTER', 'GERENTE', 'SUPERVISOR', 'BKO', 'PROMOTOR'],
  SUPERVISOR: ['BKO', 'PROMOTOR'],
};

export function perfisGerenciaveis(perfil) {
  return PODE_GERIR[perfil] ?? [];
}

/**
 * Usuário "dono" dos dados de negócio: o supervisor da equipe.
 * Master e supervisor são donos de si mesmos; os demais herdam do superior.
 */
export function resolverDonoId(usuario) {
  if (usuario.perfil === 'MASTER' || usuario.perfil === 'SUPERVISOR') return usuario.id;
  return usuario.superiorId ?? usuario.id;
}

/** Campos do usuário que podem ser devolvidos pela API. */
export const USUARIO_PUBLICO = {
  id: true,
  perfil: true,
  nome: true,
  email: true,
  cargo: true,
  departamento: true,
  telefone: true,
  fotoUrl: true,
  ativo: true,
  superiorId: true,
  permissoes: true,
  permissaoEstrategia: true,
  permissaoImportacao: true,
  supervisoresGerenciados: true,
  ultimoLogin: true,
  criadoEm: true,
};

/** O ator pode "acessar o ambiente" do alvo? Master: qualquer supervisor; gerente/BKO: os associados. */
export function podeEntrarComo(ator, alvo) {
  if (alvo.perfil !== 'SUPERVISOR' || !alvo.ativo) return false;
  if (ator.perfil === 'MASTER') return true;
  if (ator.perfil === 'GERENTE' || ator.perfil === 'BKO') {
    return Array.isArray(ator.supervisoresGerenciados) && ator.supervisoresGerenciados.includes(alvo.id);
  }
  return false;
}

/** Filtro Prisma dos supervisores que o usuário pode enxergar nos painéis. */
export function supervisoresVisiveis(usuario) {
  if (usuario.perfil === 'MASTER') return {};
  const ids = Array.isArray(usuario.supervisoresGerenciados) ? usuario.supervisoresGerenciados : [];
  return { id: { in: ids } };
}
