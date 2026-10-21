import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Database, LogOut, Moon, Search, Sun, Upload } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { gruposDoPerfil } from '../lib/menu.js';

/** Paleta de comandos: navegar, executar ações e buscar registros (Ctrl/⌘ + K). */
export default function CommandPalette({ aberto, onClose }) {
  const navigate = useNavigate();
  const { usuario, sair } = useAuth();
  const { tema, alternar } = useTheme();
  const [texto, setTexto] = useState('');
  const [debounced, setDebounced] = useState('');
  const [indice, setIndice] = useState(0);
  const lista = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    setTexto('');
    setIndice(0);
  }, [aberto]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(texto.trim()), 220);
    return () => clearTimeout(t);
  }, [texto]);

  const { data: busca } = useQuery({
    queryKey: ['/busca', debounced],
    queryFn: () => api(`/busca?q=${encodeURIComponent(debounced)}`),
    enabled: aberto && debounced.length >= 2,
    staleTime: 15_000,
  });

  const ir = (rota) => {
    onClose();
    navigate(rota);
  };

  const comandos = useMemo(() => {
    const paginas = gruposDoPerfil(usuario.perfil).flatMap((g) =>
      g.itens.map((i) => ({ id: `ir:${i.para}`, grupo: 'Ir para', titulo: i.rotulo, detalhe: g.titulo ?? 'Geral', icone: i.icone, executar: () => ir(i.para) })),
    );
    const acoes = [
      ...(usuario.perfil === 'MASTER' || usuario.permissaoImportacao
        ? [{ id: 'a:importar', grupo: 'Ações', titulo: 'Nova importação de base', detalhe: 'Bases', icone: Upload, executar: () => ir('/bases?importar=1') }]
        : []),
      { id: 'a:tema', grupo: 'Ações', titulo: tema === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro', detalhe: 'Aparência', icone: tema === 'escuro' ? Sun : Moon, executar: () => { alternar(); onClose(); } },
      { id: 'a:sair', grupo: 'Ações', titulo: 'Sair do sistema', detalhe: 'Conta', icone: LogOut, executar: () => { onClose(); sair(); } },
    ];
    return [...paginas, ...acoes];
  }, [usuario.perfil, usuario.permissaoImportacao, tema]);

  const itens = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const filtrados = q ? comandos.filter((c) => `${c.titulo} ${c.detalhe}`.toLowerCase().includes(q)) : comandos.slice(0, 9);
    const registros = (busca?.grupos ?? []).flatMap((g) =>
      g.itens.map((r) => ({ id: `r:${g.grupo}:${r.id}`, grupo: g.grupo, titulo: r.titulo, detalhe: r.detalhe, icone: Database, executar: () => ir(r.rota) })),
    );
    return [...filtrados, ...registros];
  }, [texto, comandos, busca]);

  useEffect(() => setIndice(0), [texto, busca]);

  // Mantém o item selecionado visível
  useEffect(() => {
    lista.current?.querySelector('[data-ativo="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [indice]);

  if (!aberto) return null;

  const teclado = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, itens.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      itens[indice]?.executar();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let grupoAnterior = '';

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in items-start justify-center bg-black/60 px-3 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Paleta de comandos" className="glow-border w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl shadow-lift">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-accent" />
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={teclado}
            placeholder="Buscar páginas, ações, clientes, CPF, propostas…"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
            aria-label="Buscar"
          />
          <kbd className="num rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
        </div>

        <ul ref={lista} className="max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {itens.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Nada encontrado para “{texto}”.</li>}
          {itens.map((c, i) => {
            const cabecalho = c.grupo !== grupoAnterior;
            grupoAnterior = c.grupo;
            const Icone = c.icone;
            return (
              <li key={c.id} role="option" aria-selected={i === indice}>
                {cabecalho && <p className="kicker px-3 pb-1 pt-3">{c.grupo}</p>}
                <button
                  data-ativo={i === indice}
                  onMouseEnter={() => setIndice(i)}
                  onClick={c.executar}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    i === indice ? 'bg-primary/15 text-fg' : 'text-fg/90'
                  }`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${i === indice ? 'bg-primary text-primary-fg' : 'bg-surface2 text-muted'}`}>
                    <Icone size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.titulo}</span>
                  <span className="truncate text-xs text-muted">{c.detalhe}</span>
                  {i === indice && <CornerDownLeft size={14} className="shrink-0 text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-3">
            <span><kbd className="num">↑↓</kbd> navegar</span>
            <span><kbd className="num">↵</kbd> abrir</span>
          </span>
          <span className="num">PRO-CRM</span>
        </footer>
      </div>
    </div>
  );
}
