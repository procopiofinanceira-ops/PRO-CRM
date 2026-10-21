import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Table2, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { dataHoraBR } from '../../lib/format.js';
import { EstadoVazio, LinhasSkeleton } from '../Estados.jsx';
import { useToast } from '../Toast.jsx';

/** Histórico de importações de planilhas. */
export default function Importacoes({ verConvenio }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: ['/importacoes'],
    queryFn: () => api('/importacoes'),
    select: (r) => r.itens,
  });

  const excluir = useMutation({
    mutationFn: (id) => api(`/importacoes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.sucesso('Importação excluída.');
      qc.invalidateQueries({ queryKey: ['/importacoes'] });
      qc.invalidateQueries({ queryKey: ['/leads'] });
      qc.invalidateQueries({ queryKey: ['/bases'] });
    },
    onError: (e) => toast.erro(e.message),
  });

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface2/60">
            <tr>
              {['Arquivo', 'Convênio', 'Leads', 'Duplicados', 'Data', ''].map((h) => (
                <th key={h} className="kicker whitespace-nowrap px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="stagger divide-y divide-line/70">
            {data?.map((i, n) => (
              <tr key={i.id} style={{ '--i': Math.min(n, 12) }} className="transition hover:bg-surface2/60">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{i.arquivo}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {i.convenio}
                  {i.codConvenio && <span className="num ml-1.5 text-xs text-accent">#{i.codConvenio}</span>}
                </td>
                <td className="num whitespace-nowrap px-4 py-3">{i.totalLinhas.toLocaleString('pt-BR')}</td>
                <td className="num whitespace-nowrap px-4 py-3 text-muted">{i.duplicados.toLocaleString('pt-BR')}</td>
                <td className="num whitespace-nowrap px-4 py-3 text-muted">{dataHoraBR(i.dataImportacao ?? i.criadoEm)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button className="btn-ghost !px-3 !py-1.5" onClick={() => verConvenio(i.convenio)}>
                    <Table2 size={14} /> Abrir tabela
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-1.5 text-primary"
                    aria-label={`Excluir importação ${i.arquivo}`}
                    onClick={() => window.confirm(`Excluir a importação "${i.arquivo}" e todos os seus leads?`) && excluir.mutate(i.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading && <LinhasSkeleton colunas={5} />}
      {error && <p className="p-6 text-center text-sm text-primary">{error.message}</p>}
      {data?.length === 0 && <EstadoVazio texto="Nenhuma importação ainda" dica="Clique em Nova importação para enviar uma planilha." />}
    </div>
  );
}
