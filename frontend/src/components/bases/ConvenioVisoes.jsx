import { AlertTriangle, Building2, Share2, Table2, UserPlus } from 'lucide-react';
import AnelStatus from '../AnelStatus.jsx';
import { STATUS_LEAD } from '../../lib/leads.js';
import { BarraStatus, FaixaAtualizado, haQuanto, useRelogio } from './ConvenioCard.jsx';

const trabalhadosDe = (c) => c.totalLeads - (c.porStatus.novo ?? 0);
const pctDe = (c) => (c.totalLeads ? Math.round((trabalhadosDe(c) / c.totalLeads) * 100) : 0);

const PASSA_MOUSE =
  'transition-[translate,scale,box-shadow] duration-300 ease-out hover:z-10 hover:shadow-xl hover:shadow-primary/30 hover:[scale:1.03] hover:[translate:0_-6px]';

/** Versão compacta do aviso de atualização, para a visão em lista. */
function SeloAtualizado({ data }) {
  useRelogio();
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
      <span className="live-dot !bg-accent" /> Atualizada
      <span className="num font-medium normal-case tracking-normal">{haQuanto(data)}</span>
    </span>
  );
}

/** Convênio como cartão quadrado, com o anel de situação no centro. */
export function ConvenioQuadrado({ c, podeGerir, podeDistribuir = podeGerir, indice = 0, onAbrir, onDetalhes, onDistribuir }) {
  return (
    <article
      className={`card glow-border group flex aspect-square min-h-[17.5rem] animate-fade-up flex-col ${PASSA_MOUSE}`}
      style={{ animationDelay: `${Math.min(indice, 11) * 45}ms` }}
    >
      {c.recente && <FaixaAtualizado data={c.ultimaAtualizacao} />}

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <button type="button" onClick={onDetalhes} className="flex min-h-0 flex-1 flex-col text-left" aria-label={`Detalhes de ${c.convenio}`}>
          <div className="flex items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Building2 size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{c.convenio}</h3>
              <div className="flex flex-wrap items-center gap-x-2">
                {c.codConvenio && <span className="num text-[10px] text-muted">#{c.codConvenio}</span>}
                {c.equipe && <span className="truncate text-[10px] text-accent" title="Supervisor da base">{c.equipe}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center py-2">
            <AnelStatus porStatus={c.porStatus} total={c.totalLeads} trabalhados={trabalhadosDe(c)} className="max-w-[8rem]" />
          </div>

          <div className="flex items-end justify-between gap-2 text-[11px]">
            <p className="text-muted">
              <span className="num text-base font-semibold text-text">{c.totalLeads.toLocaleString('pt-BR')}</span> registros
            </p>
            <div className="flex items-center gap-1.5">
              {podeGerir && c.semResponsavel > 0 && (
                <span className="inline-flex items-center gap-1 text-muted" title="Sem responsável">
                  <UserPlus size={11} /> <span className="num">{c.semResponsavel.toLocaleString('pt-BR')}</span>
                </span>
              )}
              {c.multiConvenio > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-500" title="Clientes em vários convênios">
                  <AlertTriangle size={11} /> <span className="num">{c.multiConvenio.toLocaleString('pt-BR')}</span>
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="mt-3 flex gap-2">
          <button className="btn-primary flex-1 !py-1.5 text-xs" onClick={onAbrir}>
            <Table2 size={14} /> Abrir
          </button>
          {podeDistribuir && (
            <button className="btn-outline !px-2.5 !py-1.5" onClick={onDistribuir} title="Distribuir para promotores" aria-label={`Distribuir ${c.convenio}`}>
              <Share2 size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** Convênio como faixa horizontal: a lista fica densa e comparável de relance. */
export function ConvenioLinha({ c, podeGerir, podeDistribuir = podeGerir, indice = 0, onAbrir, onDetalhes, onDistribuir }) {
  return (
    <article
      className="card glow-border flex animate-fade-up flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 transition duration-300 hover:shadow-lg hover:shadow-primary/20"
      style={{ animationDelay: `${Math.min(indice, 11) * 35}ms` }}
    >
      <button type="button" onClick={onDetalhes} className="flex min-w-[14rem] flex-1 items-center gap-3 text-left" aria-label={`Detalhes de ${c.convenio}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Building2 size={18} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{c.convenio}</span>
            {c.recente && <SeloAtualizado data={c.ultimaAtualizacao} />}
          </span>
          <span className="num text-[11px] text-muted">
            {c.codConvenio ? `#${c.codConvenio} · ` : ''}
            {c.equipe ? `${c.equipe} · ` : ''}
            {c.importacoes} importaç{c.importacoes === 1 ? 'ão' : 'ões'}
          </span>
        </span>
      </button>

      <div className="w-28 text-right">
        <p className="num text-xl font-semibold leading-none">{c.totalLeads.toLocaleString('pt-BR')}</p>
        <p className="kicker mt-1">registros</p>
      </div>

      <div className="min-w-[10rem] flex-1">
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>Trabalhado</span>
          <span className="num text-text">{pctDe(c)}%</span>
        </div>
        <BarraStatus porStatus={c.porStatus} total={c.totalLeads} alta="h-2.5" />
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
          {STATUS_LEAD.filter((s) => c.porStatus[s.valor] > 0).map((s) => (
            <span key={s.valor} className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${s.barra}`} /> {s.rotulo}{' '}
              <span className="num text-text">{c.porStatus[s.valor].toLocaleString('pt-BR')}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        {podeGerir && c.semResponsavel > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted/50 px-2 py-0.5 text-muted">
            <UserPlus size={11} /> <span className="num">{c.semResponsavel.toLocaleString('pt-BR')}</span> sem responsável
          </span>
        )}
        {c.multiConvenio > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={11} /> <span className="num">{c.multiConvenio.toLocaleString('pt-BR')}</span> em vários
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button className="btn-primary !py-1.5 text-xs" onClick={onAbrir}>
          <Table2 size={14} /> Abrir tabela
        </button>
        {podeDistribuir && (
          <button className="btn-outline !px-2.5 !py-1.5" onClick={onDistribuir} title="Distribuir para promotores" aria-label={`Distribuir ${c.convenio}`}>
            <Share2 size={14} />
          </button>
        )}
      </div>
    </article>
  );
}

export { pctDe };
