import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, Share2, Table2, UserPlus } from 'lucide-react';
import { STATUS_LEAD } from '../../lib/leads.js';
import { useContagem } from '../../lib/useContagem.js';

export function haQuanto(data) {
  if (!data) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

const iniciais = (nome) =>
  nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

/** Faixa no topo do cartão que avisa que a base foi atualizada há pouco e conta o tempo ao vivo. */
/** Faz o componente redesenhar a cada 30 s, para o "há X min" andar sozinho. */
export function useRelogio() {
  const [, atualizar] = useState(0);
  useEffect(() => {
    const id = setInterval(() => atualizar((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
}

export function FaixaAtualizado({ data }) {
  useRelogio();
  return (
    <div className="flex items-center justify-between gap-2 rounded-t-2xl border-b border-accent/30 bg-gradient-to-r from-accent/20 via-accent/10 to-transparent px-4 py-1.5">
      <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
        <span className="live-dot !bg-accent" /> Base atualizada
      </span>
      <span className="num rounded-md border border-accent/30 bg-bg/40 px-1.5 py-0.5 text-[10px] font-medium text-accent">
        {haQuanto(data)}
      </span>
    </div>
  );
}

/** Barra segmentada com a distribuição dos leads por situação. */
export function BarraStatus({ porStatus, total, alta = 'h-2' }) {
  return (
    <div className={`flex ${alta} w-full overflow-hidden rounded-full bg-surface2`} role="img" aria-label="Distribuição por situação">
      {STATUS_LEAD.map((s) => {
        const n = porStatus[s.valor] ?? 0;
        return n ? (
          <div
            key={s.valor}
            className={`${s.barra} transition-all duration-700`}
            style={{ width: `${(n / total) * 100}%` }}
            title={`${s.rotulo}: ${n.toLocaleString('pt-BR')}`}
          />
        ) : null;
      })}
    </div>
  );
}

/** Um cartão por convênio, no painel de Bases. */
export default function ConvenioCard({ c, podeGerir, indice = 0, onAbrir, onDistribuir, onDetalhes }) {
  const total = useContagem(c.totalLeads, 700);
  const trabalhados = c.totalLeads - (c.porStatus.novo ?? 0);
  const pct = c.totalLeads ? Math.round((trabalhados / c.totalLeads) * 100) : 0;

  return (
    <article
      className={`glow-border hud group relative flex animate-fade-up flex-col rounded-2xl shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift ${
        c.recente ? 'animate-led-glow' : ''
      }`}
      style={{ animationDelay: `${Math.min(indice, 11) * 50}ms` }}
    >
      {c.recente && <FaixaAtualizado data={c.ultimaAtualizacao} />}

      <button onClick={onDetalhes} className="flex flex-col gap-4 p-5 text-left" aria-label={`Detalhes de ${c.convenio}`}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-bg shadow-glow-accent">
            <Building2 size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{c.convenio}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {c.codConvenio && (
                <span className="num rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  #{c.codConvenio}
                </span>
              )}
              {podeGerir && c.importacoes > 0 && (
                <span className="kicker !text-[9px]">{c.importacoes} importaç{c.importacoes > 1 ? 'ões' : 'ão'}</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <p className="kicker mb-1">Registros</p>
          <div className="flex items-end justify-between gap-3">
            <p className="num text-3xl font-semibold leading-none">{Math.round(total).toLocaleString('pt-BR')}</p>
            <p className="num text-xs text-muted">
              <span className="text-fg">{pct}%</span> trabalhado
            </p>
          </div>
          <div className="mt-3">
            <BarraStatus porStatus={c.porStatus} total={c.totalLeads} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_LEAD.filter((s) => c.porStatus[s.valor] > 0).map((s) => (
            <span key={s.valor} className={`num rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cor}`}>
              {s.rotulo}: {c.porStatus[s.valor].toLocaleString('pt-BR')}
            </span>
          ))}
        </div>

        {podeGerir && (c.responsaveis.length > 0 || c.semResponsavel > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {c.responsaveis.slice(0, 4).map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2/60 py-0.5 pl-0.5 pr-2 text-[10px] font-medium">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-accent2/40 text-[9px] font-bold">
                  {iniciais(r.nome)}
                </span>
                {r.nome.split(' ')[0]}
                <span className="num text-muted">{r.quantidade.toLocaleString('pt-BR')}</span>
              </span>
            ))}
            {c.responsaveis.length > 4 && <span className="num text-[10px] text-muted">+{c.responsaveis.length - 4}</span>}
            {c.semResponsavel > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted/50 px-2 py-0.5 text-[10px] text-muted">
                <UserPlus size={10} /> <span className="num">{c.semResponsavel.toLocaleString('pt-BR')}</span> sem responsável
              </span>
            )}
          </div>
        )}

        {c.multiConvenio > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} className="shrink-0" />
            <span>
              <span className="num">{c.multiConvenio.toLocaleString('pt-BR')}</span> cliente{c.multiConvenio > 1 ? 's' : ''} em vários convênios
            </span>
          </div>
        )}
      </button>

      <div className="mt-auto flex gap-2 px-5 pb-5">
        <button className="btn-primary flex-1 !py-2" onClick={onAbrir}>
          <Table2 size={15} /> Abrir tabela
        </button>
        {podeGerir && (
          <button className="btn-outline !px-3 !py-2" onClick={onDistribuir} title="Distribuir para promotores" aria-label={`Distribuir ${c.convenio}`}>
            <Share2 size={15} />
          </button>
        )}
      </div>
    </article>
  );
}
