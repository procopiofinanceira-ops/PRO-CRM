import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api } from '../../lib/api.js';
import { formatarCpf } from '../../lib/leads.js';
import { EstadoVazio, LinhasSkeleton } from '../Estados.jsx';
import Modal from '../Modal.jsx';

/** Clientes (CPF) que aparecem em mais de um convênio. */
export default function DuplicadosModal({ onBuscar, onClose }) {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['/bases/duplicados', pagina],
    queryFn: () => api(`/bases/duplicados?pagina=${pagina}`),
    placeholderData: (anterior) => anterior,
  });
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.limite)) : 1;

  return (
    <Modal titulo="Clientes em vários convênios" onClose={onClose} largura="max-w-3xl">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p>
          O mesmo CPF aparece em bases de convênios diferentes. Isso é comum (a pessoa pode ter vínculos distintos), mas vale conferir
          antes de abordar o cliente mais de uma vez.
        </p>
      </div>

      {isLoading && <LinhasSkeleton colunas={3} linhas={5} />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {data?.itens.length === 0 && <EstadoVazio texto="Nenhum cliente repetido entre convênios" dica="As suas bases não têm CPFs em comum." />}

      {data?.itens.length > 0 && (
        <>
          <div className="card overflow-hidden">
            <div className="max-h-[48vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface/95 backdrop-blur">
                  <tr className="border-b border-line">
                    {['CPF', 'Cliente', 'Convênios', ''].map((h) => (
                      <th key={h} className="kicker whitespace-nowrap px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {data.itens.map((d) => (
                    <tr key={d.cpf} className="transition hover:bg-surface2/60">
                      <td className="num whitespace-nowrap px-4 py-2.5">{formatarCpf(d.cpf)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium">{d.nome ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {d.convenios.map((c) => (
                            <span key={c} className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => onBuscar(d.cpf)} aria-label={`Ver leads do CPF ${d.cpf}`}>
                          <Search size={14} /> Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="num mt-3 flex items-center justify-between text-sm text-muted">
            <span>{data.total.toLocaleString('pt-BR')} CPFs repetidos</span>
            <div className="flex items-center gap-2">
              <button className="btn-outline !p-1.5" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>
              <span>{pagina}/{totalPaginas}</span>
              <button className="btn-outline !p-1.5" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
