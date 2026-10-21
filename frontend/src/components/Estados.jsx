import { Inbox } from 'lucide-react';

export const Skeleton = ({ className = '', style }) => (
  <div className={`skeleton ${className}`} style={style} aria-hidden="true" />
);

/** Carregamento genérico, no lugar do texto "Carregando…". */
export function Carregando({ linhas = 3 }) {
  return (
    <div className="space-y-3 py-1" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

/** Linhas de tabela em carregamento. */
export function LinhasSkeleton({ colunas = 5, linhas = 5 }) {
  return (
    <div className="divide-y divide-line" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex gap-6 px-4 py-4">
          {Array.from({ length: colunas }, (_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Cartões em carregamento. */
export function CartoesSkeleton({ quantidade = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando">
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Mensagem amigável quando não há registros. */
export function EstadoVazio({ icone: Icone = Inbox, texto, dica, children }) {
  return (
    <div className="flex animate-fade-up flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icone size={26} />
      </span>
      <p className="mt-1 text-sm font-medium">{texto}</p>
      {dica && <p className="max-w-sm text-xs text-muted">{dica}</p>}
      {children}
    </div>
  );
}
