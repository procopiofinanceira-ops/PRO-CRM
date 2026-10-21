import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const INTERVALO = 30_000;

function haQuanto(data) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export default function Notificacoes() {
  const { impersonadoPor } = useAuth();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);

  const { data } = useQuery({
    queryKey: ['/notificacoes'],
    queryFn: () => api('/notificacoes'),
    refetchInterval: INTERVALO,
  });

  const atualizar = () => qc.invalidateQueries({ queryKey: ['/notificacoes'] });
  const ler = useMutation({ mutationFn: (id) => api(`/notificacoes/${id}/ler`, { method: 'POST' }), onSuccess: atualizar });
  const lerTodas = useMutation({ mutationFn: () => api('/notificacoes/ler-todas', { method: 'POST' }), onSuccess: atualizar });
  const apagar = useMutation({ mutationFn: (id) => api(`/notificacoes/${id}`, { method: 'DELETE' }), onSuccess: atualizar });

  // Fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => raiz.current && !raiz.current.contains(e.target) && setAberto(false);
    const esc = (e) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const itens = data?.itens ?? [];
  const naoLidas = data?.naoLidas ?? 0;

  return (
    <div ref={raiz} className="relative">
      <button
        className="btn-outline relative !p-2"
        onClick={() => setAberto((v) => !v)}
        aria-label={naoLidas ? `Notificações: ${naoLidas} não lidas` : 'Notificações'}
        aria-expanded={aberto}
      >
        <Bell size={18} />
        {naoLidas > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-fg">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="card absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notificações</h2>
            {naoLidas > 0 && !impersonadoPor && (
              <button
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                onClick={() => lerTodas.mutate()}
              >
                <CheckCheck size={14} /> Marcar todas como lidas
              </button>
            )}
          </header>

          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {itens.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação.</li>}
            {itens.map((n) => (
              <li key={n.id} className={`group flex gap-3 px-4 py-3 ${n.lida ? '' : 'bg-primary/5'}`}>
                <button
                  className="min-w-0 flex-1 text-left"
                  disabled={n.lida || Boolean(impersonadoPor)}
                  onClick={() => ler.mutate(n.id)}
                >
                  <p className={`text-sm ${n.lida ? '' : 'font-semibold'}`}>{n.titulo}</p>
                  {n.mensagem && <p className="mt-0.5 text-xs text-muted">{n.mensagem}</p>}
                  <p className="mt-1 text-[11px] text-muted">{haQuanto(n.criadoEm)}</p>
                </button>
                {!impersonadoPor && (
                  <button
                    className="self-start text-muted opacity-0 transition hover:text-primary group-hover:opacity-100 focus:opacity-100"
                    aria-label="Excluir notificação"
                    onClick={() => apagar.mutate(n.id)}
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
