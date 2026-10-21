import { Fragment, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api.js';

const SUGESTOES = [
  'Como importo uma planilha?',
  'Como distribuo leads para os promotores?',
  'Como funciona o funil de oportunidades?',
  'Como registro uma proposta imobiliária?',
];

const MAX_HISTORICO = 12;

// Renderização mínima de markdown (negrito, listas e parágrafos), sempre como texto: sem HTML injetado
function Negrito({ texto }) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? <strong key={i}>{parte.slice(2, -2)}</strong> : <Fragment key={i}>{parte}</Fragment>,
  );
}

function Texto({ texto }) {
  return (
    <div className="space-y-1.5">
      {texto.split('\n').map((linha, i) => {
        const l = linha.trimEnd();
        if (!l.trim()) return null;
        const item = l.match(/^\s*[-*•]\s+(.*)$/);
        if (item) {
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden>•</span>
              <span><Negrito texto={item[1]} /></span>
            </p>
          );
        }
        return <p key={i}><Negrito texto={l.replace(/^#+\s*/, '')} /></p>;
      })}
    </div>
  );
}

export default function Assistente() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fim = useRef(null);

  const { data: status } = useQuery({
    queryKey: ['/assistente/status'],
    queryFn: () => api('/assistente/status'),
    staleTime: 60_000,
  });

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [mensagens, enviando, aberto]);

  if (!status?.disponivel) return null;

  const perguntar = async (pergunta) => {
    const p = pergunta.trim();
    if (!p || enviando) return;
    setErro('');
    setTexto('');
    const historico = mensagens.slice(-MAX_HISTORICO).map((m) => ({ role: m.role, texto: m.texto }));
    setMensagens((m) => [...m, { role: 'user', texto: p }]);
    setEnviando(true);
    try {
      const r = await api('/assistente/perguntar', { method: 'POST', body: { pergunta: p, historico } });
      setMensagens((m) => [...m, { role: 'assistant', texto: r.resposta }]);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-fg shadow-lg transition hover:scale-105 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          aria-label="Abrir o assistente virtual"
          title="Assistente virtual"
        >
          <Sparkles size={24} />
        </button>
      )}

      {aberto && (
        <section
          className="card fixed inset-x-3 bottom-3 z-40 flex h-[min(34rem,calc(100vh-1.5rem))] flex-col overflow-hidden sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[24rem]"
          aria-label="Assistente virtual"
        >
          <header className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-fg">
            <Sparkles size={18} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Assistente do PRO-CRM</h2>
              <p className="text-xs text-white/80">Tire dúvidas sobre o sistema</p>
            </div>
            {mensagens.length > 0 && (
              <button className="rounded-lg p-1.5 hover:bg-white/20" aria-label="Nova conversa" title="Nova conversa" onClick={() => { setMensagens([]); setErro(''); }}>
                <RotateCcw size={16} />
              </button>
            )}
            <button className="rounded-lg p-1.5 hover:bg-white/20" aria-label="Fechar o assistente" onClick={() => setAberto(false)}>
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {mensagens.length === 0 && (
              <div>
                <p className="mb-3 text-muted">Olá! Posso explicar as telas e o passo a passo do sistema. Por exemplo:</p>
                <div className="flex flex-col gap-2">
                  {SUGESTOES.map((s) => (
                    <button key={s} className="rounded-xl border border-line px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5" onClick={() => perguntar(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'rounded-br-md bg-primary text-primary-fg' : 'rounded-bl-md bg-surface2'}`}>
                  {m.role === 'user' ? <p className="whitespace-pre-wrap break-words">{m.texto}</p> : <Texto texto={m.texto} />}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-surface2 px-3.5 py-2.5 text-muted">
                  <Loader2 size={14} className="animate-spin" /> Pensando…
                </div>
              </div>
            )}

            {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-primary" role="alert">{erro}</p>}
            <div ref={fim} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              perguntar(texto);
            }}
          >
            <textarea
              rows={1}
              maxLength={2000}
              className="input max-h-28 resize-none"
              placeholder="Escreva sua dúvida…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  perguntar(texto);
                }
              }}
            />
            <button className="btn-primary !px-3.5" disabled={!texto.trim() || enviando} aria-label="Enviar">
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
