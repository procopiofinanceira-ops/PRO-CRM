import { AlertTriangle, Building2, Clock, Database, Gauge, UserX } from 'lucide-react';
import { useContagem } from '../../lib/useContagem.js';
import { haQuanto } from './ConvenioCard.jsx';

function Anel({ pct }) {
  const R = 18;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r={R} fill="none" strokeWidth="4" className="stroke-surface2" />
      <circle
        cx="22" cy="22" r={R} fill="none" strokeWidth="4" strokeLinecap="round"
        className="stroke-accent" strokeDasharray={`${(pct / 100) * C} ${C}`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1)', filter: 'drop-shadow(0 0 4px rgb(var(--accent)))' }}
      />
    </svg>
  );
}

function Tile({ icone: Icone, rotulo, valor, sufixo, tom = 'text-accent', alerta = false, atraso = 0, children }) {
  const n = useContagem(typeof valor === 'number' ? valor : 0, 900);
  return (
    <div
      className={`glow-border hud animate-fade-up rounded-2xl p-4 ${alerta ? 'shadow-[0_0_0_1px_rgb(245_158_11/0.4)]' : ''}`}
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="kicker">{rotulo}</p>
        {children ?? <Icone size={16} className={tom} />}
      </div>
      <p className="num mt-2 text-2xl font-semibold leading-none">
        {typeof valor === 'number' ? Math.round(n).toLocaleString('pt-BR') : valor}
        {sufixo && <span className="ml-1 text-sm font-medium text-muted">{sufixo}</span>}
      </p>
    </div>
  );
}

/** Faixa de indicadores no topo da tela de Bases. */
export default function BasesHud({ r, podeGerir }) {
  if (!r) return null;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Tile icone={Database} rotulo="Registros" valor={r.totalLeads} atraso={0} />
      <Tile icone={Building2} rotulo="Convênios" valor={r.convenios} atraso={60} tom="text-accent2" />
      <Tile rotulo="Trabalhado" valor={r.aproveitamento} sufixo="%" atraso={120}>
        <Anel pct={r.aproveitamento} />
      </Tile>
      {podeGerir ? (
        <>
          <Tile icone={UserX} rotulo="Sem responsável" valor={r.semResponsavel} atraso={180} tom="text-primary" />
          <Tile icone={AlertTriangle} rotulo="CPFs repetidos" valor={r.duplicados} atraso={240} tom="text-amber-500" alerta={r.duplicados > 0} />
        </>
      ) : (
        <Tile icone={Gauge} rotulo="Em trabalho" valor={r.trabalhados} atraso={180} tom="text-emerald-500" />
      )}
      <Tile icone={Clock} rotulo="Última atualização" valor={haQuanto(r.ultimaAtualizacao)} atraso={300} tom="text-muted" />
    </div>
  );
}
