import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(null);
const DURACAO = 3800;

export function ToastProvider({ children }) {
  const [itens, setItens] = useState([]);
  const proximo = useRef(1);

  const remover = useCallback((id) => setItens((l) => l.filter((t) => t.id !== id)), []);

  const mostrar = useCallback(
    (tipo, texto) => {
      const id = proximo.current++;
      setItens((l) => [...l.slice(-3), { id, tipo, texto }]);
      setTimeout(() => remover(id), DURACAO);
    },
    [remover],
  );

  const api = useMemo(
    () => ({ sucesso: (t) => mostrar('sucesso', t), erro: (t) => mostrar('erro', t) }),
    [mostrar],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:bottom-auto sm:items-end"
        aria-live="polite"
      >
        {itens.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'erro' ? 'alert' : 'status'}
            className="card pointer-events-auto flex max-w-sm animate-slide-left items-start gap-3 py-3 pl-4 pr-3 shadow-lift"
          >
            {t.tipo === 'erro' ? (
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-primary" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
            )}
            <p className="flex-1 text-sm">{t.texto}</p>
            <button className="text-muted transition hover:text-fg" onClick={() => remover(t.id)} aria-label="Fechar aviso">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
