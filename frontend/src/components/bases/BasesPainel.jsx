import { useContagem } from '../../lib/useContagem.js';
import { haQuanto } from './ConvenioCard.jsx';

function Numero({ valor }) {
  const n = useContagem(valor, 900);
  return Math.round(n).toLocaleString('pt-BR');
}

function Dado({ rotulo, children, alerta }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="kicker">{rotulo}</p>
      <p className={`num mt-1 text-xl font-semibold leading-none ${alerta ? 'text-amber-500' : ''}`}>{children}</p>
    </div>
  );
}

/** Uma faixa só, com os indicadores das bases separados por divisórias. */
export default function BasesPainel({ r, podeGerir }) {
  if (!r) return null;
  return (
    <section className="card hud mb-5 overflow-hidden">
      <div className="h-1 w-full bg-surface2" role="progressbar" aria-valuenow={r.aproveitamento} aria-valuemin={0} aria-valuemax={100} aria-label="Leads trabalhados">
        <div className="h-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000 ease-out" style={{ width: `${r.aproveitamento}%` }} />
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        <Dado rotulo="Registros">
          <Numero valor={r.totalLeads} />
        </Dado>
        <Dado rotulo="Convênios">
          <Numero valor={r.convenios} />
        </Dado>
        <Dado rotulo="Trabalhado">
          {r.aproveitamento}
          <span className="ml-0.5 text-sm font-medium text-muted">%</span>
        </Dado>
        {podeGerir ? (
          <>
            <Dado rotulo="Sem responsável">
              <Numero valor={r.semResponsavel} />
            </Dado>
            <Dado rotulo="CPFs repetidos" alerta={r.duplicados > 0}>
              <Numero valor={r.duplicados} />
            </Dado>
          </>
        ) : (
          <Dado rotulo="Em trabalho">
            <Numero valor={r.trabalhados} />
          </Dado>
        )}
        <Dado rotulo="Última atualização">
          <span className="text-base">{haQuanto(r.ultimaAtualizacao)}</span>
        </Dado>
      </div>
    </section>
  );
}
