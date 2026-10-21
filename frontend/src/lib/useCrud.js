import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';
import { useToast } from '../components/Toast.jsx';

/** Lista + criar/editar/excluir para um endpoint REST (ex.: '/contatos'). */
export function useCrud(endpoint, params = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  ).toString();

  const lista = useQuery({
    queryKey: [endpoint, params],
    queryFn: () => api(`${endpoint}${query ? `?${query}` : ''}`),
    select: (r) => r.itens,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: [endpoint] });

  const salvar = useMutation({
    mutationFn: ({ id, ...dados }) =>
      id
        ? api(`${endpoint}/${id}`, { method: 'PUT', body: dados })
        : api(endpoint, { method: 'POST', body: dados }),
    onSuccess: (_r, vars) => {
      invalidar();
      toast.sucesso(vars.id ? 'Alterações salvas.' : 'Registro criado.');
    },
    // Erros de formulário aparecem no próprio modal; quem usa `mutate` direto (ex.: arrastar cartão) avisa por conta própria
  });

  const excluir = useMutation({
    mutationFn: (id) => api(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidar();
      toast.sucesso('Registro excluído.');
    },
    onError: (e) => toast.erro(e.message),
  });

  return { lista, salvar, excluir, invalidar };
}
