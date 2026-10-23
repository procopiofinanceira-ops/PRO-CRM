import { useEffect, useState } from 'react';
import { STATUS_LEAD } from '../lib/leads.js';

const STROKE = {
  novo: 'stroke-slate-400',
  contatado: 'stroke-sky-500',
  interesse: 'stroke-violet-500',
  agendado: 'stroke-amber-500',
  convertido: 'stroke-emerald-500',
  sem_interesse: 'stroke-primary',
};

const R = 44;
const C = 2 * Math.PI * R;

/** Anel com um arco por situação dos leads; o miolo mostra a % já trabalhada. */
export default function AnelStatus({ porStatus, total, trabalhados, className = 'max-w-[9.5rem]' }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let acumulado = 0;
  const pct = total ? Math.round((trabalhados / total) * 100) : 0;
  return (
    <div className={`relative mx-auto aspect-square w-full ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-surface2" />
        {STATUS_LEAD.map((s) => {
          const n = porStatus[s.valor] ?? 0;
          if (!n) return null;
          const tamanho = (n / total) * C;
          const desloca = acumulado;
          acumulado += tamanho;
          return (
            <circle
              key={s.valor}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              strokeWidth="9"
              className={`${STROKE[s.valor]} transition-[stroke-dasharray] duration-1000 ease-out`}
              strokeDasharray={pronto ? `${Math.max(tamanho - 1, 0)} ${C}` : `0 ${C}`}
              strokeDashoffset={-desloca}
            >
              <title>{`${s.rotulo}: ${n}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="num text-3xl font-semibold leading-none">
            {pct}
            <span className="text-base text-muted">%</span>
          </p>
          <p className="kicker mt-1">trabalhado</p>
        </div>
      </div>
    </div>
  );
}
