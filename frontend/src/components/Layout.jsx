import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Camera, KeyRound, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { TODOS, gruposDoPerfil } from '../lib/menu.js';
import Assistente from './Assistente.jsx';
import AlterarSenhaModal from './AlterarSenhaModal.jsx';
import simbolo from '../assets/logo-simbolo.png';
import Avatar from './Avatar.jsx';
import FotoPerfilModal from './FotoPerfilModal.jsx';
import CommandPalette from './CommandPalette.jsx';
import Notificacoes from './Notificacoes.jsx';

const PERFIL = {
  MASTER: 'Master',
  GERENTE: 'Gerente',
  SUPERVISOR: 'Supervisor',
  BKO: 'BKO',
  PROMOTOR: 'Promotor',
};

const dataHoje = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Layout() {
  const { usuario, impersonadoPor, voltar, sair } = useAuth();
  const { tema, alternar } = useTheme();
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [trocandoFoto, setTrocandoFoto] = useState(false);
  // No computador o menu pode ficar só com os ícones; a escolha fica salva no navegador
  const [recolhido, setRecolhido] = useState(() => {
    try {
      return localStorage.getItem('menu:recolhido') === '1';
    } catch {
      return false;
    }
  });
  const alternarMenu = () =>
    setRecolhido((v) => {
      try {
        localStorage.setItem('menu:recolhido', v ? '0' : '1');
      } catch {
        /* sem armazenamento: só não lembra */
      }
      return !v;
    });

  // Ctrl/⌘ + K abre a paleta de comandos em qualquer tela
  useEffect(() => {
    const atalho = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta((v) => !v);
      }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  const grupos = gruposDoPerfil(usuario.perfil);
  const atual = TODOS.filter((i) => (i.fim ? pathname === i.para : pathname.startsWith(i.para))).sort(
    (a, b) => b.para.length - a.para.length,
  )[0];

  return (
    <div className={`min-h-screen transition-[grid-template-columns] duration-300 ease-out lg:grid ${recolhido ? 'lg:grid-cols-[76px_1fr]' : 'lg:grid-cols-[272px_1fr]'}`}>
      {aberto && <div className="fixed inset-0 z-30 animate-fade-in bg-black/50 backdrop-blur-[2px] lg:hidden" onClick={() => setAberto(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-line bg-surface/80 p-4 backdrop-blur-2xl transition-[transform,width] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          recolhido ? 'lg:w-[76px] lg:px-3' : ''
        } ${aberto ? 'translate-x-0 shadow-lift' : '-translate-x-full'}`}
      >
        {/* Brilho técnico no topo da barra lateral */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent" />

        <button
          type="button"
          onClick={alternarMenu}
          className="absolute -right-3 top-7 z-50 hidden h-6 w-6 place-items-center rounded-full border border-line bg-surface text-muted shadow-card transition hover:border-primary/50 hover:text-primary lg:grid"
          title={recolhido ? 'Abrir menu' : 'Recolher menu'}
          aria-label={recolhido ? 'Abrir menu' : 'Recolher menu'}
          aria-expanded={!recolhido}
        >
          {recolhido ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
        </button>

        <div className={`relative mb-5 flex items-center justify-between px-2 ${recolhido ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="flex items-center gap-3">
            <img src={simbolo} alt="Procópio" className="h-9 w-auto shrink-0 drop-shadow-[0_0_10px_rgb(var(--primary)/0.45)]" draggable={false} />
            <div className={`leading-tight ${recolhido ? 'lg:hidden' : ''}`}>
              <span className="block text-base font-semibold tracking-tight">PRO-CRM</span>
              <span className="kicker block !text-[9px]">Procópio Financeira</span>
            </div>
          </div>
          <button className="btn-ghost !p-1.5 lg:hidden" onClick={() => setAberto(false)} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <nav className="relative -mx-1 flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-2" aria-label="Menu principal">
          {grupos.map((g, gi) => (
            <div key={g.titulo ?? gi} className="flex flex-col gap-0.5">
              {g.titulo && <p className={`kicker px-3 pb-1 ${recolhido ? 'lg:hidden' : ''}`}>{g.titulo}</p>}
              {g.titulo && recolhido && <div aria-hidden="true" className="mx-3 mb-1 hidden h-px bg-line lg:block" />}
              {g.itens.map(({ para, rotulo, icone: Icone, fim }) => (
                <NavLink
                  key={para}
                  to={para}
                  end={fim}
                  onClick={() => setAberto(false)}
                  title={recolhido ? rotulo : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      recolhido ? 'lg:justify-center lg:px-0' : ''
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-primary/20 to-transparent text-fg shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.25)]'
                        : 'text-muted hover:bg-surface2/70 hover:text-fg'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={`absolute -left-1 top-1/2 w-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_rgb(var(--primary))] transition-all duration-300 ${
                          isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'
                        }`}
                      />
                      <Icone
                        size={18}
                        className={`shrink-0 transition-all duration-200 group-hover:scale-110 ${isActive ? 'text-primary' : ''}`}
                      />
                      <span className={`truncate ${recolhido ? 'lg:hidden' : ''}`}>{rotulo}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={`relative mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface2/60 p-3 backdrop-blur ${recolhido ? 'lg:flex-col lg:gap-2 lg:px-1' : ''}`}>
          {/* A foto abre a troca de foto; durante "acessar ambiente" ela é só de exibição */}
          <button
            type="button"
            className="group relative shrink-0 rounded-full"
            onClick={() => !impersonadoPor && setTrocandoFoto(true)}
            disabled={Boolean(impersonadoPor)}
            title={impersonadoPor ? undefined : 'Alterar foto'}
            aria-label="Alterar foto do perfil"
          >
            <Avatar usuario={usuario} className="h-10 w-10 text-xs" />
            {!impersonadoPor && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 transition group-hover:opacity-100">
                <Camera size={15} className="text-white" />
              </span>
            )}
            <span className="live-dot absolute -bottom-0.5 -right-0.5 ring-2 ring-surface" title="Conectado" />
          </button>
          <div className={`min-w-0 flex-1 ${recolhido ? 'lg:hidden' : ''}`}>
            <p className="truncate text-sm font-medium">{usuario.nome}</p>
            <p className="kicker !text-[9px]">{PERFIL[usuario.perfil]}</p>
          </div>
          {!impersonadoPor && (
            <button className="btn-ghost !p-1.5" onClick={() => setTrocandoSenha(true)} title="Alterar senha" aria-label="Alterar senha">
              <KeyRound size={16} />
            </button>
          )}
          <button className="btn-ghost !p-1.5" onClick={sair} title="Sair" aria-label="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/60 px-4 py-3 backdrop-blur-2xl lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="btn-ghost !p-2 lg:hidden" onClick={() => setAberto(true)} aria-label="Abrir menu">
              <Menu size={20} />
            </button>
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="truncate text-sm font-semibold">{atual?.rotulo ?? 'PRO-CRM'}</p>
              <p className="kicker truncate !normal-case !tracking-normal first-letter:uppercase">{dataHoje()}</p>
            </div>
          </div>

          {/* Gatilho da paleta de comandos */}
          <button
            onClick={() => setPaleta(true)}
            className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-surface/60 px-3 text-left text-sm text-muted backdrop-blur transition hover:border-accent/50 hover:shadow-glow-accent sm:max-w-md"
            aria-label="Abrir a busca e os comandos"
          >
            <Search size={16} className="shrink-0 text-accent" />
            <span className="flex-1 truncate">Buscar ou ir para…</span>
            <kbd className="num hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] sm:block">Ctrl K</kbd>
          </button>

          <div className="flex items-center gap-2">
            <Notificacoes />
            <button
              className="btn-outline !p-2"
              onClick={alternar}
              title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
              aria-label="Alternar tema"
            >
              <span key={tema} className="block animate-pop">
                {tema === 'escuro' ? <Sun size={18} /> : <Moon size={18} />}
              </span>
            </button>
          </div>
        </header>

        {impersonadoPor && (
          <div className="flex animate-fade-in flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-primary to-accent2 px-4 py-2 text-sm text-primary-fg lg:px-8">
            <span>
              Você está acessando o ambiente de <strong>{usuario.nome}</strong> como {impersonadoPor.nome}.
            </span>
            <button className="rounded-lg bg-white/20 px-3 py-1 font-medium transition hover:bg-white/30 active:scale-95" onClick={voltar}>
              Voltar ao meu usuário
            </button>
          </div>
        )}

        <main key={pathname} className="animate-fade-up p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette aberto={paleta} onClose={() => setPaleta(false)} />
      <Assistente />
      {trocandoSenha && <AlterarSenhaModal onClose={() => setTrocandoSenha(false)} />}
      {trocandoFoto && <FotoPerfilModal onClose={() => setTrocandoFoto(false)} />}
    </div>
  );
}
