import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Hash, Plus, Send, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando } from '../components/Estados.jsx';

const hora = (v) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dia = (v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
const INTERVALO = 8000;

function Conversa({ canal, usuario, podeGerir, onVoltar, onExcluido }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const fim = useRef(null);

  const { data: mensagens = [] } = useQuery({
    queryKey: ['/canais', canal.id, 'mensagens'],
    queryFn: () => api(`/canais/${canal.id}/mensagens`),
    select: (r) => r.itens,
    refetchInterval: INTERVALO,
  });

  const marcarLidas = useMutation({
    mutationFn: () => api(`/canais/${canal.id}/ler`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/canais'], exact: true }),
  });

  const enviar = useMutation({
    mutationFn: (conteudo) => api(`/canais/${canal.id}/mensagens`, { method: 'POST', body: { conteudo } }),
    onSuccess: () => {
      setTexto('');
      setErro('');
      qc.invalidateQueries({ queryKey: ['/canais', canal.id, 'mensagens'] });
    },
    onError: (e) => setErro(e.message),
  });

  const excluir = useMutation({
    mutationFn: () => api(`/canais/${canal.id}`, { method: 'DELETE' }),
    onSuccess: onExcluido,
    onError: (e) => setErro(e.message),
  });

  // Rola até a última mensagem e marca como lidas o que chegou de outras pessoas
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
    if (mensagens.some((m) => !m.lida && m.remetenteId !== usuario.id)) marcarLidas.mutate();
  }, [mensagens.length]);

  let ultimoDia = '';

  return (
    <section className="card flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button className="btn-ghost !p-2 lg:hidden" onClick={onVoltar} aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <Hash size={18} className="text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{canal.nome}</h2>
          {canal.descricao && <p className="truncate text-xs text-muted">{canal.descricao}</p>}
        </div>
        {podeGerir && canal.nome !== 'Geral' && (
          <button
            className="btn-ghost !p-2 text-primary"
            aria-label="Excluir canal"
            onClick={() => {
              if (window.confirm(`Excluir o canal "${canal.nome}" e todas as mensagens?`)) excluir.mutate();
            }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {mensagens.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">Nenhuma mensagem ainda. Comece a conversa!</p>
        )}
        {mensagens.map((m) => {
          const minha = m.remetenteId === usuario.id;
          const novoDia = dia(m.criadoEm) !== ultimoDia;
          ultimoDia = dia(m.criadoEm);
          return (
            <div key={m.id}>
              {novoDia && (
                <p className="my-2 text-center text-xs font-medium capitalize text-muted">{dia(m.criadoEm)}</p>
              )}
              <div className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    minha ? 'rounded-br-md bg-primary text-primary-fg' : 'rounded-bl-md bg-surface2'
                  }`}
                >
                  {!minha && <p className="mb-0.5 text-xs font-semibold text-primary">{m.remetente?.nome ?? 'Usuário removido'}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                  <p className={`mt-1 text-right text-[10px] ${minha ? 'text-white/70' : 'text-muted'}`}>{hora(m.criadoEm)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim()) enviar.mutate(texto.trim());
        }}
      >
        {erro && <p className="mb-2 text-xs text-primary">{erro}</p>}
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            className="input max-h-32 resize-none"
            placeholder={`Mensagem para #${canal.nome}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (texto.trim()) enviar.mutate(texto.trim());
              }
            }}
          />
          <button className="btn-primary !px-3.5" disabled={!texto.trim() || enviar.isPending} aria-label="Enviar">
            <Send size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

export default function Mensagens() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const podeGerir = ['MASTER', 'SUPERVISOR'].includes(usuario.perfil);
  const [selecionado, setSelecionado] = useState(null);

  const { data: canais = [], isLoading, error } = useQuery({
    queryKey: ['/canais'],
    queryFn: () => api('/canais'),
    select: (r) => r.itens,
    refetchInterval: INTERVALO,
  });

  const criar = useMutation({
    mutationFn: (nome) => api('/canais', { method: 'POST', body: { nome } }),
    onSuccess: ({ item }) => {
      qc.invalidateQueries({ queryKey: ['/canais'], exact: true });
      setSelecionado(item.id);
    },
    onError: (e) => window.alert(e.message),
  });

  const atual = canais.find((c) => c.id === selecionado) ?? (window.innerWidth >= 1024 ? canais[0] : null);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[420px] flex-col">
      <PageHeader titulo="Mensagens" descricao="Converse com a sua equipe por canais." />

      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className={`card min-h-0 overflow-y-auto p-2 ${atual ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Canais</span>
            {podeGerir && (
              <button
                className="btn-ghost !p-1.5"
                aria-label="Novo canal"
                onClick={() => {
                  const nome = window.prompt('Nome do novo canal:');
                  if (nome?.trim()) criar.mutate(nome.trim());
                }}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          <ul className="space-y-0.5">
            {canais.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelecionado(c.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    atual?.id === c.id ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-surface2'
                  }`}
                >
                  <Hash size={16} className="shrink-0" />
                  <span className="flex-1 truncate">{c.nome}</span>
                  {c.naoLidas > 0 && (
                    <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-fg">
                      {c.naoLidas}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {atual ? (
          <Conversa
            key={atual.id}
            canal={atual}
            usuario={usuario}
            podeGerir={podeGerir}
            onVoltar={() => setSelecionado(null)}
            onExcluido={() => {
              setSelecionado(null);
              qc.invalidateQueries({ queryKey: ['/canais'], exact: true });
            }}
          />
        ) : (
          <div className="card hidden place-items-center text-sm text-muted lg:grid">Selecione um canal.</div>
        )}
      </div>
    </div>
  );
}
