import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

/** Usuários ativos da equipe (somente master e supervisor têm acesso). */
export function useEquipe(habilitado = true) {
  const consulta = useQuery({
    queryKey: ['/usuarios'],
    queryFn: () => api('/usuarios'),
    select: (r) => r.usuarios.filter((u) => u.ativo),
    enabled: habilitado,
  });
  const usuarios = consulta.data ?? [];
  return {
    usuarios,
    promotores: usuarios.filter((u) => u.perfil === 'PROMOTOR'),
    nomePorId: Object.fromEntries(usuarios.map((u) => [u.id, u.nome])),
    carregando: consulta.isLoading,
  };
}
