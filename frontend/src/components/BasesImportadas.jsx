import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Database } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { dataHoraBR } from '../lib/format.js';
import Modal from './Modal.jsx';

const INTERVALO = 30_000;
const TIPO = 'base_importada';
const VISTAS_KEY = 'procrm.basesVistas';
const JANELA_POPUP = 24 * 60 * 60 * 1000; // só avisa em pop-up bases de até 1 dia

const lerVistas = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(VISTAS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
};
const gravarVistas = (ids) => {
  try {
    localStorage.setItem(VISTAS_KEY, JSON.stringify([...ids].slice(-100)));
  } catch {
    /* sem localStorage */
  }
};

/** Ícone de banco de dados ao lado do sino: lista as bases importadas e avisa em pop-up quando chega uma nova. */
export default function BasesImportadas() {
  const { impersonadoPor } = useAuth();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [fila, setFila] = useState([]);
  const raiz = useRef(null);
  const vistas = useRef(lerVistas());

  const { data } = useQuery({
    queryKey: ['/notificacoes', TIPO],
    queryFn: () => api(`/notificacoes?tipo=${TIPO}`),
    refetchInterval: INTERVALO,
  });

  const atualizar = () => qc.invalidateQueries({ queryKey: ['/notificacoes'] });
  const ler = useMutation({ mutationFn: (id) => api(`/notificacoes/${id}/ler`, { method: 'POST' }), onSuccess: atualizar });
  const lerTodas = useMutation({ mutationFn: () => api('/notificacoes/ler-todas', { method: 'POST' }), onSuccess: atualizar });

  const itens = data?.itens ?? [];
  const naoLidas = data?.naoLidas ?? 0;

  // Base nova (não lida, recente e ainda não mostrada neste navegador) entra na fila do pop-up
  useEffect(() => {
    if (impersonadoPor) return;
    const novas = itens.filter(
      (n) => !n.lida && !vistas.current.has(n.id) && Date.now() - new Date(n.criadoEm).getTime() < JANELA_POPUP,
    );
    if (!novas.length) return;
    novas.forEach((n) => vistas.current.add(n.id));
    gravarVistas(vistas.current);
    setFila((f) => [...f, ...novas.reverse()]);
  }, [itens, impersonadoPor]);

  // Fecha a lista ao clicar fora ou apertar Esc
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

  const atual = fila[0];
  const fecharAviso = () => setFila((f) => f.slice(1));

  return (
    <>
      <div ref={raiz} className="relative">
        <button
          className="btn-outline relative !p-2"
          onClick={() => setAberto((v) => !v)}
          title="Bases importadas"
          aria-label={naoLidas ? `Bases importadas: ${naoLidas} novas` : 'Bases importadas'}
          aria-expanded={aberto}
        >
          <Database size={18} />
          {naoLidas > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-fg">
              {naoLidas > 99 ? '99+' : naoLidas}
            </span>
          )}
        </button>

        {aberto && (
          <div className="card absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Bases importadas</h2>
              {naoLidas > 0 && !impersonadoPor && (
                <button
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  onClick={() => lerTodas.mutate()}
                >
                  <CheckCheck size={14} /> Marcar como vistas
                </button>
              )}
            </header>
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {itens.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nenhuma base importada.</li>}
              {itens.map((n) => (
                <li key={n.id} className={n.lida ? '' : 'bg-primary/5'}>
                  <button
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                    disabled={n.lida || Boolean(impersonadoPor)}
                    onClick={() => ler.mutate(n.id)}
                  >
                    <Database size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${n.lida ? '' : 'font-semibold'}`}>{n.titulo}</span>
                      {n.mensagem && <span className="mt-0.5 block text-xs text-muted">{n.mensagem}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {atual && (
        <Modal titulo="Nova base importada" onClose={fecharAviso} largura="max-w-md">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <Database size={22} />
            </span>
            <div className="min-w-0">
              <p className="kicker">Base</p>
              <p className="break-words text-lg font-semibold">{atual.titulo}</p>
              <p className="kicker mt-3">Data da importação</p>
              <p className="num text-sm">{dataHoraBR(atual.criadoEm)}</p>
            </div>
          </div>
          {fila.length > 1 && <p className="mt-4 text-xs text-muted">Mais {fila.length - 1} base(s) nova(s) na fila.</p>}
          <div className="mt-6 flex justify-end">
            <button className="btn-primary" onClick={fecharAviso}>
              {fila.length > 1 ? 'Próxima' : 'Entendi'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
