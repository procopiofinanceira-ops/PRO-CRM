import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { STATUS_LEAD } from '../lib/leads.js';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando , EstadoVazio } from '../components/Estados.jsx';

export default function Acompanhamento() {
  const qc = useQueryClient();
  const [importacaoId, setImportacaoId] = useState('');

  const { data: importacoes = [] } = useQuery({
    queryKey: ['/importacoes'],
    queryFn: () => api('/importacoes'),
    select: (r) => r.itens,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['/leads/resumo', importacaoId],
    queryFn: () => api(`/leads/resumo${importacaoId ? `?importacaoId=${importacaoId}` : ''}`),
    select: (r) => r.itens,
  });

  const devolver = useMutation({
    mutationFn: (funcionarioId) =>
      api('/leads/devolver', { method: 'POST', body: { funcionarioId, ...(importacaoId && { importacaoId }) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/leads/resumo'] });
      qc.invalidateQueries({ queryKey: ['/leads'] });
    },
  });

  const total = (data ?? []).reduce((s, i) => s + i.total, 0);

  return (
    <>
      <PageHeader titulo="Acompanhamento" descricao="Como cada promotor está trabalhando os leads recebidos.">
        <select className="input !w-auto" value={importacaoId} onChange={(e) => setImportacaoId(e.target.value)}>
          <option value="">Todas as importações</option>
          {importacoes.map((i) => (
            <option key={i.id} value={i.id}>{i.arquivo} · {i.convenio}</option>
          ))}
        </select>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {STATUS_LEAD.map((s) => (
          <span key={s.valor} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${s.barra}`} /> {s.rotulo}
          </span>
        ))}
      </div>

      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {data?.length === 0 && <div className="card"><EstadoVazio texto="Nenhum lead importado ainda." /></div>}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((r) => {
          const novos = r.porStatus.novo ?? 0;
          const trabalhados = r.total - novos;
          return (
            <article key={r.funcionarioId ?? 'sem'} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{r.nome}</h3>
                  <p className="text-xs text-muted">
                    {r.total.toLocaleString('pt-BR')} leads · {trabalhados.toLocaleString('pt-BR')} trabalhados
                  </p>
                </div>
                {r.funcionarioId && novos > 0 && (
                  <button
                    className="btn-ghost !px-2.5 !py-1.5 text-xs"
                    title="Tira do promotor os leads que ele ainda não trabalhou"
                    disabled={devolver.isPending}
                    onClick={() => {
                      if (window.confirm(`Devolver ${novos} lead(s) novos de ${r.nome} para "sem responsável"?`)) {
                        devolver.mutate(r.funcionarioId);
                      }
                    }}
                  >
                    <Undo2 size={14} /> Devolver novos
                  </button>
                )}
              </div>

              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface2">
                {STATUS_LEAD.map((s) => {
                  const n = r.porStatus[s.valor] ?? 0;
                  return n ? (
                    <div
                      key={s.valor}
                      className={s.barra}
                      style={{ width: `${(n / r.total) * 100}%` }}
                      title={`${s.rotulo}: ${n}`}
                    />
                  ) : null;
                })}
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                {STATUS_LEAD.filter((s) => r.porStatus[s.valor]).map((s) => (
                  <div key={s.valor} className="rounded-lg bg-surface2 py-1.5">
                    <dd className="text-sm font-semibold">{r.porStatus[s.valor]}</dd>
                    <dt className="text-muted">{s.rotulo}</dt>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>
      {total > 0 && <p className="mt-4 text-xs text-muted">{total.toLocaleString('pt-BR')} leads no total.</p>}
    </>
  );
}
