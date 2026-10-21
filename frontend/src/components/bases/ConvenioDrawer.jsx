import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Share2, Table2, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { dataHoraBR } from '../../lib/format.js';
import { STATUS_LEAD } from '../../lib/leads.js';
import { useToast } from '../Toast.jsx';
import { BarraStatus } from './ConvenioCard.jsx';

/** Painel lateral com o detalhe de um convênio: situação, equipe e importações. */
export default function ConvenioDrawer({ c, podeGerir, onAbrir, onDistribuir, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const { data: importacoes = [] } = useQuery({
    queryKey: ['/importacoes'],
    queryFn: () => api('/importacoes'),
    select: (r) => r.itens.filter((i) => (i.convenio ?? '(sem convênio)') === c.convenio),
    enabled: podeGerir,
  });

  const excluir = useMutation({
    mutationFn: (id) => api(`/importacoes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.sucesso('Importação excluída.');
      qc.invalidateQueries({ queryKey: ['/importacoes'] });
      qc.invalidateQueries({ queryKey: ['/bases'] });
      qc.invalidateQueries({ queryKey: ['/leads'] });
    },
    onError: (e) => toast.erro(e.message),
  });

  const maior = Math.max(1, ...c.responsaveis.map((r) => r.quantidade), c.semResponsavel);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={c.convenio} className="glow-border flex h-full w-full max-w-md animate-slide-right flex-col overflow-hidden !rounded-none !border-y-0 !border-r-0 shadow-lift">
        <header className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <p className="kicker">Convênio{c.codConvenio ? ` · #${c.codConvenio}` : ''}</p>
            <h2 className="mt-1 text-lg font-semibold leading-snug">{c.convenio}</h2>
          </div>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <div className="mb-2 flex items-end justify-between">
              <p className="kicker">Registros</p>
              <p className="num text-2xl font-semibold">{c.totalLeads.toLocaleString('pt-BR')}</p>
            </div>
            <BarraStatus porStatus={c.porStatus} total={c.totalLeads} alta="h-3" />
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {STATUS_LEAD.map((s) => (
                <li key={s.valor} className="flex items-center justify-between rounded-lg bg-surface2/50 px-3 py-1.5 text-xs">
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${s.barra}`} />{s.rotulo}</span>
                  <span className="num font-semibold">{(c.porStatus[s.valor] ?? 0).toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          </section>

          {podeGerir && (
            <section>
              <p className="kicker mb-2">Equipe</p>
              {c.responsaveis.length === 0 && c.semResponsavel === 0 && <p className="text-sm text-muted">Sem leads atribuídos.</p>}
              <ul className="space-y-2.5">
                {c.responsaveis.map((r) => (
                  <li key={r.id}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{r.nome}</span><span className="num text-muted">{r.quantidade.toLocaleString('pt-BR')}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-r from-primary to-accent2" style={{ width: `${(r.quantidade / maior) * 100}%` }} /></div>
                  </li>
                ))}
                {c.semResponsavel > 0 && (
                  <li>
                    <div className="mb-1 flex justify-between text-xs"><span className="text-muted">Sem responsável</span><span className="num text-muted">{c.semResponsavel.toLocaleString('pt-BR')}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-muted/60" style={{ width: `${(c.semResponsavel / maior) * 100}%` }} /></div>
                  </li>
                )}
              </ul>
            </section>
          )}

          {c.multiConvenio > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span><strong className="num">{c.multiConvenio.toLocaleString('pt-BR')}</strong> cliente(s) desta base também aparecem em outros convênios.</span>
            </div>
          )}

          {podeGerir && (
            <section>
              <p className="kicker mb-2">Importações</p>
              {importacoes.length === 0 && <p className="text-sm text-muted">Nenhuma importação registrada.</p>}
              <ul className="space-y-2">
                {importacoes.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface2/40 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.arquivo}</p>
                      <p className="num text-[11px] text-muted">
                        {i.totalLinhas.toLocaleString('pt-BR')} leads · {i.duplicados.toLocaleString('pt-BR')} duplicados · {dataHoraBR(i.dataImportacao ?? i.criadoEm)}
                      </p>
                    </div>
                    <button
                      className="btn-ghost !p-1.5 text-primary"
                      aria-label={`Excluir importação ${i.arquivo}`}
                      onClick={() => window.confirm(`Excluir a importação "${i.arquivo}" e todos os seus leads?`) && excluir.mutate(i.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="flex gap-2 border-t border-line p-4">
          <button className="btn-primary flex-1" onClick={onAbrir}><Table2 size={15} /> Abrir tabela</button>
          {podeGerir && <button className="btn-outline" onClick={onDistribuir}><Share2 size={15} /> Distribuir</button>}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
