import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, FolderKanban, Target, Trophy, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { dataHoraBR, moeda } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';
import { useContagem } from '../lib/useContagem.js';
import { BarrasDuplas, Sparkline, useEntrada } from '../components/Graficos.jsx';
import { EstadoVazio, Skeleton } from '../components/Estados.jsx';
import { ESTAGIOS } from '../lib/oportunidade.js';

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

/** Número que "sobe" até o valor final. */
function Numero({ valor, formatar = (n) => Math.round(n).toLocaleString('pt-BR') }) {
  return formatar(useContagem(valor));
}

function Indicador({ icone: Icone, rotulo, valor, formatar, cor, serie, atraso }) {
  return (
    <div className="glow-border hud group animate-fade-up rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lift" style={{ animationDelay: `${atraso}ms` }}>
      <div className="flex items-start justify-between">
        <p className="kicker">{rotulo}</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `rgb(var(--${cor}) / 0.14)`, color: `rgb(var(--${cor}))` }}>
          <Icone size={18} />
        </span>
      </div>
      <p className="num mt-3 text-3xl font-semibold leading-none">
        <Numero valor={valor} formatar={formatar} />
      </p>
      <div className="mt-3 h-11">{serie && <Sparkline pontos={serie} cor={cor} />}</div>
    </div>
  );
}

/** Rosca com a distribuição das oportunidades por estágio. */
function Rosca({ fatias, total }) {
  const pronto = useEntrada();
  const R = 52;
  const C = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label="Oportunidades por estágio">
        <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-surface2" />
        {total > 0 &&
          fatias
            .filter((f) => f.quantidade > 0)
            .map((f) => {
              const comprimento = (f.quantidade / total) * C;
              const deslocamento = -acumulado;
              acumulado += comprimento;
              return (
                <circle
                  key={f.valor}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  strokeWidth="16"
                  className={f.stroke}
                  strokeDasharray={`${pronto ? Math.max(0, comprimento - 2) : 0} ${C}`}
                  strokeDashoffset={deslocamento}
                  style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
                />
              );
            })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="num text-3xl font-semibold"><Numero valor={total} /></p>
          <p className="kicker !text-[9px]">oportunidades</p>
        </div>
      </div>
    </div>
  );
}

function PainelSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando">
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['/dashboard'], queryFn: () => api('/dashboard') });
  const barras = useEntrada();

  if (isLoading) return <PainelSkeleton />;
  if (error) return <p className="text-sm text-primary">{error.message}</p>;

  const porEstagio = Object.fromEntries(data.oportunidades.map((o) => [o.estagio, o]));
  const abertas = data.oportunidades
    .filter((o) => !['ganhamos', 'perdemos'].includes(o.estagio))
    .reduce((s, o) => s + o.quantidade, 0);
  const total = data.oportunidades.reduce((s, o) => s + o.quantidade, 0);
  const maior = Math.max(1, ...data.oportunidades.map((o) => o.quantidade));
  const fatias = ESTAGIOS.map((e) => ({ ...e, quantidade: porEstagio[e.valor]?.quantidade ?? 0 }));
  const proximos = data.proximosEventos.length;
  const { oportunidadesCriadas, leadsTrabalhados } = data.serie;
  const trabalhadosHoje = leadsTrabalhados.at(-1)?.valor ?? 0;

  return (
    <div className="space-y-6">
      {/* Boas-vindas */}
      <section className="relative animate-fade-up overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/25 via-surface to-accent2/20 p-6 shadow-glow sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 animate-float rounded-full bg-primary/30 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 right-1/3 h-56 w-56 animate-float-slow rounded-full bg-accent/20 blur-3xl" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '22px 22px' }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker flex items-center gap-2"><span className="live-dot" /> Sistema operacional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {saudacao()}, <span className="text-gradient">{usuario.nome.split(' ')[0]}</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted">
              {abertas > 0
                ? `Você tem ${abertas} oportunidade${abertas > 1 ? 's' : ''} em andamento`
                : 'Nenhuma oportunidade em andamento no momento'}
              {proximos > 0 ? ` e ${proximos} compromisso${proximos > 1 ? 's' : ''} agendado${proximos > 1 ? 's' : ''}.` : '.'}
            </p>
          </div>
          <div className="num rounded-2xl border border-line bg-surface/60 px-5 py-3 text-right backdrop-blur">
            <p className="kicker">Leads trabalhados hoje</p>
            <p className="mt-1 text-3xl font-semibold text-accent"><Numero valor={trabalhadosHoje} /></p>
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={Users} rotulo="Contatos" valor={data.totalContatos} cor="accent" atraso={60} />
        <Indicador icone={Target} rotulo="Oportunidades abertas" valor={abertas} cor="accent2" serie={oportunidadesCriadas} atraso={120} />
        <Indicador icone={Trophy} rotulo="Valor ganho" valor={porEstagio.ganhamos?.valor ?? 0} formatar={moeda} cor="primary" atraso={180} />
        <Indicador icone={FolderKanban} rotulo="Projetos em andamento" valor={data.projetosAtivos} cor="accent" serie={leadsTrabalhados} atraso={240} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Atividade */}
        <section className="card animate-fade-up p-6 lg:col-span-2" style={{ animationDelay: '280ms' }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">Atividade dos últimos 14 dias</h2>
            <span className="kicker">Ao vivo</span>
          </div>
          <BarrasDuplas a={oportunidadesCriadas} b={leadsTrabalhados} rotuloA="Oportunidades criadas" rotuloB="Leads trabalhados" />
        </section>

        {/* Próximos eventos */}
        <section className="card animate-fade-up p-6" style={{ animationDelay: '340ms' }}>
          <h2 className="mb-4 font-semibold">Próximos eventos</h2>
          {proximos === 0 ? (
            <EstadoVazio icone={CalendarClock} texto="Nenhum evento agendado" dica="Os compromissos do calendário aparecem aqui." />
          ) : (
            <ul className="stagger space-y-2">
              {data.proximosEventos.map((ev, i) => (
                <li key={ev.id} style={{ '--i': i }} className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-surface2">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-center leading-none text-primary">
                    <span>
                      <span className="num block text-base font-semibold">{new Date(ev.dataInicio).getDate()}</span>
                      <span className="block text-[9px] font-semibold uppercase">
                        {new Date(ev.dataInicio).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                      </span>
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ev.titulo}</p>
                    <p className="num text-xs text-muted">{dataHoraBR(ev.dataInicio)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Retornos agendados (hoje ou atrasados) */}
      {data.retornos?.total > 0 && (
        <section className="card animate-fade-up border-amber-500/40 p-6" style={{ animationDelay: '360ms' }}>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
              <Bell size={18} className="animate-pulse" />
            </span>
            <div>
              <h2 className="font-semibold">Retornos para fazer</h2>
              <p className="text-xs text-muted">
                <span className="num">{data.retornos.total}</span> cliente{data.retornos.total > 1 ? 's' : ''} com retorno agendado para hoje ou atrasado
              </p>
            </div>
          </div>
          <ul className="stagger grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.retornos.itens.map((r, i) => (
              <li key={r.id} style={{ '--i': i }}>
                <Link to="/oportunidades" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface2/40 px-3 py-2.5 transition hover:border-amber-500/50 hover:bg-amber-500/5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.nome}</span>
                    <span className="block truncate text-xs text-muted">{r.empresa ?? 'Sem convênio'}</span>
                  </span>
                  <span className="num shrink-0 text-xs text-amber-600 dark:text-amber-400">
                    {new Date(r.dataRetorno).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })}
                    {r.horaRetorno ? ` ${r.horaRetorno}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Funil */}
      <section className="card animate-fade-up p-6" style={{ animationDelay: '400ms' }}>
        <h2 className="mb-5 font-semibold">Funil de vendas</h2>
        <div className="grid items-center gap-8 md:grid-cols-[11rem_1fr]">
          <Rosca fatias={fatias} total={total} />
          <div className="space-y-3.5">
            {fatias.map((f, i) => (
              <div key={f.valor} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted">{f.rotulo}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div
                    className={`h-full rounded-full ${f.cor}`}
                    style={{
                      width: barras ? `${(f.quantidade / maior) * 100}%` : '0%',
                      transition: `width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${i * 70}ms`,
                    }}
                  />
                </div>
                <span className="num w-8 text-right font-medium">{f.quantidade}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
