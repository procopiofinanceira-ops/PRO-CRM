import { useEffect, useId, useState } from 'react';

/** Marca o primeiro quadro depois da montagem, para disparar transições CSS de entrada. */
export function useEntrada() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const q = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(q);
  }, []);
  return pronto;
}

/** Mini-gráfico de linha com área em degradê (cor = nome de uma variável CSS: primary, accent...). */
export function Sparkline({ pontos, cor = 'accent', alto = 44 }) {
  const id = useId().replace(/:/g, '');
  const pronto = useEntrada();
  const valores = pontos.map((p) => p.valor);
  const max = Math.max(1, ...valores);
  const largura = 160;
  const passo = largura / Math.max(1, valores.length - 1);
  const y = (v) => alto - 4 - (v / max) * (alto - 10);
  const linha = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * passo).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${linha} L${largura},${alto} L0,${alto} Z`;
  const corCss = `rgb(var(--${cor}))`;

  return (
    <svg viewBox={`0 0 ${largura} ${alto}`} className="h-11 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Tendência dos últimos dias">
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={corCss} stopOpacity="0.4" />
          <stop offset="100%" stopColor={corCss} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${id})`} style={{ opacity: pronto ? 1 : 0, transition: 'opacity 0.9s ease 0.3s' }} />
      <path
        d={linha}
        fill="none"
        stroke={corCss}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={pronto ? 0 : 1}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)', filter: `drop-shadow(0 0 4px ${corCss})`, vectorEffect: 'non-scaling-stroke' }}
      />
    </svg>
  );
}

/** Barras agrupadas (duas séries) por dia. */
export function BarrasDuplas({ a, b, rotuloA, rotuloB }) {
  const pronto = useEntrada();
  const max = Math.max(1, ...a.map((p) => p.valor), ...b.map((p) => p.valor));
  const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit' });

  return (
    <div>
      <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Atividade por dia">
        {a.map((p, i) => (
          <div key={p.dia} className="group relative flex h-full flex-1 items-end justify-center gap-[3px]">
            {[
              { v: p.valor, cor: 'bg-gradient-to-t from-primary/60 to-primary' },
              { v: b[i]?.valor ?? 0, cor: 'bg-gradient-to-t from-accent/60 to-accent' },
            ].map((s, k) => (
              <div
                key={k}
                className={`w-full max-w-[14px] rounded-t-md ${s.cor}`}
                style={{
                  height: pronto ? `${Math.max((s.v / max) * 100, s.v ? 6 : 2)}%` : '2%',
                  opacity: s.v ? 1 : 0.25,
                  transition: `height 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${i * 35 + k * 60}ms`,
                }}
              />
            ))}
            <div className="num pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-[10px] shadow-lift group-hover:block">
              {dia(p.dia)}: <span className="text-primary">{p.valor}</span> · <span className="text-accent">{b[i]?.valor ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="num mt-2 flex justify-between text-[10px] text-muted">
        <span>{dia(a[0].dia)}</span>
        <span>{dia(a[a.length - 1].dia)}</span>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />{rotuloA}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />{rotuloB}</span>
      </div>
    </div>
  );
}
