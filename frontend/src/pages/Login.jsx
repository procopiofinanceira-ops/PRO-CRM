import { useEffect, useState } from 'react';
import { BarChart3, Eye, EyeOff, Home, Loader2, Moon, ShieldCheck, Sun, Users } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useTheme } from '../lib/theme.jsx';

const DESTAQUES = [
  { icone: Users, titulo: 'Equipe e leads no lugar certo', texto: 'Distribua bases e acompanhe cada promotor.' },
  { icone: Home, titulo: 'Crédito imobiliário do início ao fim', texto: 'Propostas, documentos e simulações em um só lugar.' },
  { icone: BarChart3, titulo: 'Visão clara do funil', texto: 'Oportunidades, metas e resultados em tempo real.' },
];

export default function Login() {
  const { entrar, verificarCodigo } = useAuth();
  const { tema, alternar } = useTheme();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState('senha');
  // Aviso deixado por uma sessão derrubada (ex.: login em outro computador)
  const [erro, setErro] = useState(() => {
    try {
      return sessionStorage.getItem('procrm.aviso') ?? '';
    } catch {
      return '';
    }
  });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem('procrm.aviso');
    } catch {
      /* sem sessionStorage */
    }
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (etapa === 'senha') {
        const r = await entrar(email, senha);
        if (r.etapa === 'otp') setEtapa('otp');
      } else {
        await verificarCodigo(email, codigo);
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Painel da marca */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#e23a47] via-primary to-[#8f1520] p-12 text-primary-fg lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-[28rem] w-[28rem] animate-float rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-20 h-[30rem] w-[30rem] animate-float-slow rounded-full bg-black/25 blur-3xl" />
        <div aria-hidden="true" className="absolute left-1/3 top-1/2 h-72 w-72 animate-float rounded-full bg-white/10 blur-3xl [animation-delay:-6s]" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '26px 26px' }}
        />

        <div className="relative flex animate-fade-up items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-xl font-bold backdrop-blur">P</span>
          <div className="leading-tight">
            <p className="text-xl font-semibold tracking-tight">PRO-CRM</p>
            <p className="text-sm text-white/75">Procópio Financeira</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h2 className="animate-fade-up text-[2.6rem] font-semibold leading-[1.1] tracking-tight [animation-delay:80ms]">
            Cada cliente no lugar certo, cada venda no tempo certo.
          </h2>
          <ul className="mt-10 space-y-5">
            {DESTAQUES.map(({ icone: Icone, titulo, texto }, i) => (
              <li key={titulo} className="flex animate-fade-up gap-4" style={{ animationDelay: `${220 + i * 110}ms` }}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <Icone size={20} />
                </span>
                <div>
                  <p className="font-medium">{titulo}</p>
                  <p className="text-sm text-white/75">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck size={14} /> Acesso protegido e dados separados por equipe.
        </p>
      </section>

      {/* Formulário */}
      <section className="relative flex items-center justify-center p-6">
        <button className="btn-outline absolute right-4 top-4 !p-2" onClick={alternar} aria-label="Alternar tema">
          <span key={tema} className="block animate-pop">{tema === 'escuro' ? <Sun size={18} /> : <Moon size={18} />}</span>
        </button>

        <form onSubmit={enviar} className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 font-bold text-primary-fg shadow-glow">P</span>
            <span className="text-lg font-semibold tracking-tight">PRO-CRM</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">{etapa === 'senha' ? 'Bem-vindo de volta' : 'Verifique seu e-mail'}</h1>
          <p className="mb-7 mt-2 text-sm text-muted">
            {etapa === 'senha' ? 'Entre com a sua conta para continuar.' : `Enviamos um código de 6 dígitos para ${email}.`}
          </p>

          {etapa === 'senha' ? (
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  className="input !py-2.5"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="senha">Senha</label>
                <div className="relative">
                  <input
                    id="senha"
                    type={mostrar ? 'text' : 'password'}
                    className="input !py-2.5 pr-11"
                    autoComplete="current-password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:text-fg"
                    onClick={() => setMostrar((m) => !m)}
                    aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="codigo">Código de verificação</label>
              <input
                id="codigo"
                className="input text-center text-2xl tracking-[0.5em]"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}

          {erro && (
            <p className="mt-4 animate-scale-in rounded-xl bg-primary/10 px-3 py-2.5 text-sm text-primary" role="alert">
              {erro}
            </p>
          )}

          <button className="btn-primary mt-6 w-full !py-2.5" disabled={enviando}>
            {enviando && <Loader2 size={16} className="animate-spin" />}
            {etapa === 'senha' ? 'Entrar' : 'Confirmar'}
          </button>

          {etapa === 'otp' && (
            <button
              type="button"
              className="btn-ghost mt-2 w-full"
              onClick={() => {
                setEtapa('senha');
                setCodigo('');
                setErro('');
              }}
            >
              Voltar
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
