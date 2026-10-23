import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Undo2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { STATUS_LEAD } from '../lib/leads.js';
import AnelStatus from '../components/AnelStatus.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando, EstadoVazio } from '../components/Estados.jsx';

const ORDENS = [
  { valor: 'trabalhados', rotulo: 'Mais trabalhados' },
  { valor: 'convertidos', rotulo: 'Mais convertidos' },
  { valor: 'total', rotulo: 'Mais leads' },
];

const pct = (parte, todo) => (todo ? Math.round((parte / todo) * 100) : 0);
const iniciais = (nome) =>
  (nome ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export default function Acompanhamento() {
  const qc = useQueryClient();
  const [importacaoId, setImportacaoId] = useState('');
  const [ordem, setOrdem] = useState('trabalhados');

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

  const lista = useMemo(() => {
    const itens = (data ?? []).map((r) => ({ ...r, trabalhados: r.total - (r.porStatus.novo ?? 0) }));
    const chave = {
      trabalhados: (r) => pct(r.trabalhados, r.total),
      convertidos: (r) => r.porStatus.convertido ?? 0,
      total: (r) => r.total,
    }[ordem];
    return itens.sort((a, b) => chave(b) - chave(a) || b.total - a.total);
  }, [data, ordem]);

  const geral = useMemo(() => {
    const soma = Object.fromEntries(STATUS_LEAD.map((s) => [s.valor, 0]));
    let total = 0;
    for (const r of data ?? []) {
      total += r.total;
      for (const s of STATUS_LEAD) soma[s.valor] += r.porStatus[s.valor] ?? 0;
    }
    return { total, soma, trabalhados: total - soma.novo };
  }, [data]);

  return (
    <>
      <PageHeader titulo="Acompanhamento" descricao="Como cada promotor está trabalhando os leads recebidos.">
        <select className="input !w-auto" value={importacaoId} onChange={(e) => setImportacaoId(e.target.value)}>
          <option value="">Todas as importações</option>
          {importacoes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.arquivo} · {i.convenio}
            </option>
          ))}
        </select>
      </PageHeader>

      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {data?.length === 0 && (
        <div className="card">
          <EstadoVazio texto="Nenhum lead importado ainda." />
        </div>
      )}

      {geral.total > 0 && (
        <>
          {/* Faixa geral: o retrato da equipe inteira */}
          <section className="card hud glow-border mb-5 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="kicker">Equipe</p>
                <p className="num text-4xl font-semibold leading-none">{geral.total.toLocaleString('pt-BR')}</p>
                <p className="mt-1 text-xs text-muted">
                  leads · {pct(geral.trabalhados, geral.total)}% já trabalhados ·{' '}
                  {geral.soma.convertido.toLocaleString('pt-BR')} convertidos
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {STATUS_LEAD.map((s) => (
                  <div key={s.valor} className="flex items-center gap-2">
                    <span className={`h-8 w-1 rounded-full ${s.barra}`} />
                    <div>
                      <p className="num text-lg font-semibold leading-none">{geral.soma[s.valor].toLocaleString('pt-BR')}</p>
                      <p className="text-[11px] text-muted">{s.rotulo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="kicker mr-1">Ordenar</span>
            {ORDENS.map((o) => (
              <button
                key={o.valor}
                type="button"
                aria-pressed={ordem === o.valor}
                onClick={() => setOrdem(o.valor)}
                className={`rounded-full border px-3 py-1 font-medium transition ${
                  ordem === o.valor ? 'border-primary bg-primary/15 text-primary' : 'border-line text-muted hover:text-text'
                }`}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {lista.map((r, i) => {
          const novos = r.porStatus.novo ?? 0;
          return (
            <article
              key={r.funcionarioId ?? 'sem'}
              style={{ '--i': Math.min(i, 12) }}
              className="card glow-border flex aspect-square flex-col p-4 transition-[translate,scale,box-shadow] duration-300 ease-out hover:z-10 hover:shadow-xl hover:shadow-primary/30 hover:[scale:1.04] hover:[translate:0_-6px]"
            >
              <header className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {iniciais(r.nome)}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{r.nome}</h3>
                  <p className="text-[11px] text-muted">
                    {r.total.toLocaleString('pt-BR')} leads · {r.trabalhados.toLocaleString('pt-BR')} trabalhados
                  </p>
                </div>
                {i === 0 && ordem !== 'total' && lista.length > 1 && (
                  <Trophy size={16} className="shrink-0 text-amber-500" aria-label="Primeiro do ranking" />
                )}
              </header>

              <div className="flex flex-1 items-center py-2">
                <AnelStatus porStatus={r.porStatus} total={r.total} trabalhados={r.trabalhados} />
              </div>

              <footer className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-1">
                  {STATUS_LEAD.filter((s) => r.porStatus[s.valor]).map((s) => (
                    <span key={s.valor} className="inline-flex items-center gap-1 text-muted" title={s.rotulo}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.barra}`} />
                      <span className="num text-text">{r.porStatus[s.valor]}</span>
                    </span>
                  ))}
                </div>
                {r.funcionarioId && novos > 0 && (
                  <button
                    className="btn-ghost shrink-0 !px-2 !py-1 text-[11px]"
                    title="Tira do promotor os leads que ele ainda não trabalhou"
                    disabled={devolver.isPending}
                    onClick={() => {
                      if (window.confirm(`Devolver ${novos} lead(s) novos de ${r.nome} para "sem responsável"?`)) {
                        devolver.mutate(r.funcionarioId);
                      }
                    }}
                  >
                    <Undo2 size={12} /> Devolver
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}
