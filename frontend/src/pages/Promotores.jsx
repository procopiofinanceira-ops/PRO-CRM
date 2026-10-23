import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Building2, CalendarDays, ChevronLeft, Loader2, Search, Trash2, Unlock, Users, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { dataBR, moeda } from '../lib/format.js';
import { formatarCpf } from '../lib/leads.js';
import { CLASSE_ESTAGIO, ESTAGIOS, ROTULO_ESTAGIO } from '../lib/oportunidade.js';
import OportunidadeModal from '../components/crm/OportunidadeModal.jsx';
import { CartoesSkeleton, EstadoVazio, LinhasSkeleton } from '../components/Estados.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const rotuloMes = (m) => {
  const [a, n] = m.split('-');
  return `${NOMES_MES[Number(n) - 1]} de ${a}`;
};
const iniciais = (nome) =>
  nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

function ChipsEstagio({ porEstagio, pequeno = false }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ESTAGIOS.filter((e) => porEstagio[e.valor] > 0).map((e) => (
        <span
          key={e.valor}
          className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold ${CLASSE_ESTAGIO[e.valor]} ${pequeno ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}
        >
          {e.rotulo}
          <span className="num rounded-full bg-black/10 px-1.5 dark:bg-white/10">{porEstagio[e.valor]}</span>
        </span>
      ))}
    </div>
  );
}

/** Confirmação genérica de ações destrutivas. */
function Confirmar({ titulo, texto, rotuloBotao, pendente, onConfirmar, onClose, children }) {
  return (
    <Modal titulo={titulo} onClose={onClose}>
      <p className="text-sm text-muted">{texto}</p>
      {children}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={pendente} onClick={onConfirmar}>
          {pendente && <Loader2 size={15} className="animate-spin" />} {rotuloBotao}
        </button>
      </div>
    </Modal>
  );
}

// ---------------- Visão geral por convênio ----------------
function VisaoGeral({ convenios }) {
  if (convenios.length === 0) {
    return <div className="card"><EstadoVazio icone={Building2} texto="Nenhum cliente atribuído a promotores ainda" dica="Quando um cliente tiver um promotor responsável, ele aparece aqui." /></div>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {convenios.map((c, i) => (
        <article key={c.convenio} className="glow-border hud animate-fade-up rounded-2xl p-5" style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-bg">
                <Building2 size={18} />
              </span>
              <h3 className="truncate text-sm font-semibold">{c.convenio}</h3>
            </div>
            <span className="num shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
              {c.total} cliente{c.total > 1 ? 's' : ''}
            </span>
          </div>
          <ChipsEstagio porEstagio={c.porEstagio} />
        </article>
      ))}
    </div>
  );
}

// ---------------- Lista de promotores ----------------
function ListaPromotores({ promotores, master, onAbrir }) {
  const [busca, setBusca] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [estagio, setEstagio] = useState('');
  const [soComClientes, setSoComClientes] = useState(false);

  const supervisores = useMemo(() => [...new Set(promotores.map((p) => p.supervisor).filter(Boolean))].sort(), [promotores]);
  const filtrados = promotores.filter(
    (p) =>
      (!busca || `${p.nome} ${p.email}`.toLowerCase().includes(busca.toLowerCase())) &&
      (!supervisor || p.supervisor === supervisor) &&
      (!estagio || (p.porEstagio[estagio] ?? 0) > 0) &&
      (!soComClientes || p.total > 0),
  );
  const filtrando = busca || supervisor || estagio || soComClientes;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
          <input className="input pl-9" placeholder="Buscar promotor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {master && supervisores.length > 0 && (
          <select className="input !w-auto" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} aria-label="Filtrar por supervisor">
            <option value="">Todos os supervisores</option>
            {supervisores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select className="input !w-auto" value={estagio} onChange={(e) => setEstagio(e.target.value)} aria-label="Filtrar por estágio">
          <option value="">Todos os estágios</option>
          {ESTAGIOS.map((e) => <option key={e.valor} value={e.valor}>{e.rotulo}</option>)}
        </select>
        <button className={`btn-outline ${soComClientes ? '!border-accent/60 !text-accent' : ''}`} onClick={() => setSoComClientes((v) => !v)} aria-pressed={soComClientes}>
          Só com clientes
        </button>
        {filtrando && (
          <button className="btn-ghost" onClick={() => { setBusca(''); setSupervisor(''); setEstagio(''); setSoComClientes(false); }}>
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="card"><EstadoVazio icone={Users} texto={filtrando ? 'Nenhum promotor encontrado' : 'Nenhum promotor cadastrado'} dica={filtrando ? 'Ajuste os filtros.' : 'Cadastre promotores na tela Usuários.'} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onAbrir(p)}
              className="glow-border animate-fade-up rounded-2xl p-5 text-left transition duration-300 hover:-translate-y-1 hover:shadow-lift"
              style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-accent2/40 text-sm font-bold">{iniciais(p.nome)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.nome}</p>
                  <p className="truncate text-xs text-muted">{master && p.supervisor ? `Supervisor: ${p.supervisor}` : p.email}</p>
                </div>
                <span className="num text-2xl font-semibold">{p.total}</span>
              </div>
              <div className="mt-4">
                {p.total > 0 ? <ChipsEstagio porEstagio={p.porEstagio} pequeno /> : <p className="text-xs text-muted">Nenhum cliente em vendas</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------- Detalhe de um promotor ----------------
function DetalhePromotor({ promotor, promotores, mes, onVoltar }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [estagio, setEstagio] = useState('');
  const [busca, setBusca] = useState('');
  const [motivo, setMotivo] = useState('');
  const [marcados, setMarcados] = useState(() => new Set());
  const [modal, setModal] = useState(null); // 'transferir' | 'convenio' | 'tudo'
  const [destino, setDestino] = useState('');
  const [convenioExcluir, setConvenioExcluir] = useState('');
  const [aberta, setAberta] = useState(null);

  const params = new URLSearchParams({ ...(estagio && { estagio }), ...(busca && { q: busca }), ...(motivo && { motivo }), ...(mes && { mes }) }).toString();
  const { data, isLoading, error } = useQuery({
    queryKey: ['/promotores', promotor.id, 'clientes', params],
    queryFn: () => api(`/promotores/${promotor.id}/clientes${params ? `?${params}` : ''}`),
    placeholderData: (anterior) => anterior,
  });
  // Totais por estágio sem os filtros de estágio/busca, para os contadores das abas
  const { data: todos } = useQuery({
    queryKey: ['/promotores', promotor.id, 'clientes', mes ?? ''],
    queryFn: () => api(`/promotores/${promotor.id}/clientes${mes ? `?mes=${mes}` : ''}`),
  });

  const itens = data?.itens ?? [];
  const contagem = useMemo(() => {
    const c = {};
    for (const o of todos?.itens ?? []) c[o.estagio] = (c[o.estagio] ?? 0) + 1;
    return c;
  }, [todos]);
  const conveniosDoPromotor = useMemo(() => [...new Set((todos?.itens ?? []).map((o) => o.empresa ?? 'Sem convênio'))].sort(), [todos]);
  const outros = promotores.filter((p) => p.id !== promotor.id);

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['/promotores'] });
    qc.invalidateQueries({ queryKey: ['/oportunidades'] });
    setMarcados(new Set());
    setModal(null);
  };

  const transferir = useMutation({
    mutationFn: () => api('/promotores/transferir', { method: 'POST', body: { ids: [...marcados], destinoId: destino } }),
    onSuccess: (r) => {
      toast.sucesso(`${r.transferidos} cliente(s) transferido(s).${r.ignorados ? ` ${r.ignorados} ignorado(s).` : ''}`);
      atualizar();
    },
    onError: (e) => toast.erro(e.message),
  });
  const excluir = useMutation({
    mutationFn: (convenio) => api(`/promotores/${promotor.id}/clientes${convenio ? `?convenio=${encodeURIComponent(convenio)}` : ''}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      toast.sucesso(`${r.excluidos} cliente(s) excluído(s).`);
      atualizar();
    },
    onError: (e) => toast.erro(e.message),
  });

  const alternar = (id) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todosMarcados = itens.length > 0 && itens.every((o) => marcados.has(o.id));

  const abrirCliente = async (id) => {
    try {
      const { item } = await api(`/oportunidades/${id}`);
      setAberta(item);
    } catch (e) {
      toast.erro(e.message);
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button className="btn-outline !p-2" onClick={onVoltar} aria-label="Voltar para a lista"><ChevronLeft size={18} /></button>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-accent2/40 text-sm font-bold">{iniciais(promotor.nome)}</span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{promotor.nome}</h2>
          <p className="text-xs text-muted">{promotor.supervisor ? `Supervisor: ${promotor.supervisor} · ` : ''}{promotor.email}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn-outline" disabled={!conveniosDoPromotor.length} onClick={() => { setConvenioExcluir(conveniosDoPromotor[0] ?? ''); setModal('convenio'); }}>
            <Trash2 size={15} className="text-amber-500" /> Excluir por convênio
          </button>
          <button className="btn-outline" disabled={!(todos?.total > 0)} onClick={() => setModal('tudo')}>
            <Trash2 size={15} className="text-primary" /> Excluir todos
          </button>
        </div>
      </div>

      {/* Abas de estágio com contador */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setEstagio('')} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${!estagio ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-fg'}`}>
          Todos <span className="num ml-1">{todos?.total ?? 0}</span>
        </button>
        {ESTAGIOS.filter((e) => contagem[e.valor] > 0).map((e) => (
          <button key={e.valor} onClick={() => setEstagio(e.valor)} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${estagio === e.valor ? CLASSE_ESTAGIO[e.valor] : 'border-line text-muted hover:text-fg'}`}>
            {e.rotulo} <span className="num ml-1">{contagem[e.valor]}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
          <input className="input pl-9" placeholder="Nome, CPF ou convênio…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {estagio === 'perdemos' && (
          <input className="input !w-64" placeholder="Filtrar pelo motivo da perda…" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Filtrar pelo motivo da perda" />
        )}
        {marcados.size > 0 && (
          <div className="ml-auto flex animate-fade-in items-center gap-2">
            <span className="num rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">{marcados.size} selecionado{marcados.size > 1 ? 's' : ''}</span>
            <button className="btn-primary" onClick={() => { setDestino(outros[0]?.id ?? ''); setModal('transferir'); }} disabled={outros.length === 0}>
              <ArrowRightLeft size={15} /> Transferir
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface2/60">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={todosMarcados} onChange={() => setMarcados(todosMarcados ? new Set() : new Set(itens.map((o) => o.id)))} aria-label="Selecionar todos" className="h-4 w-4 accent-[rgb(var(--accent))]" />
                </th>
                {['Cliente', 'CPF', 'Convênio', 'Estágio', 'Receita esperada', 'Atualizado'].map((h) => <th key={h} className="kicker whitespace-nowrap px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {itens.map((o) => (
                <tr key={o.id} onClick={() => abrirCliente(o.id)} className={`cursor-pointer transition ${marcados.has(o.id) ? 'bg-accent/10' : 'hover:bg-surface2/60'}`}>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={marcados.has(o.id)} onChange={() => alternar(o.id)} aria-label={`Selecionar ${o.nome}`} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{o.nome}</td>
                  <td className="num whitespace-nowrap px-4 py-2.5 text-muted">{formatarCpf(o.cpf)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{o.empresa ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${CLASSE_ESTAGIO[o.estagio]}`}>{ROTULO_ESTAGIO[o.estagio]}</span>
                    {o.estagio === 'perdemos' && o.motivoPerda && <span className="ml-2 text-xs text-muted" title={o.motivoPerda}>{o.motivoPerda.length > 34 ? `${o.motivoPerda.slice(0, 34)}…` : o.motivoPerda}</span>}
                  </td>
                  <td className="num whitespace-nowrap px-4 py-2.5">{o.receitaEsperada != null ? moeda(o.receitaEsperada) : '—'}</td>
                  <td className="num whitespace-nowrap px-4 py-2.5 text-muted">{dataBR(o.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <LinhasSkeleton colunas={6} />}
        {error && <p className="p-6 text-center text-sm text-primary">{error.message}</p>}
        {!isLoading && itens.length === 0 && <EstadoVazio icone={Users} texto="Nenhum cliente encontrado" dica="Este promotor não tem clientes com esses filtros." />}
      </div>

      {modal === 'transferir' && (
        <Confirmar titulo="Transferir clientes" texto={`Passar ${marcados.size} cliente(s) de ${promotor.nome} para outro promotor da mesma equipe.`} rotuloBotao="Transferir" pendente={transferir.isPending} onConfirmar={() => transferir.mutate()} onClose={() => setModal(null)}>
          <label className="label mt-4" htmlFor="destino">Promotor de destino</label>
          <select id="destino" className="input" value={destino} onChange={(e) => setDestino(e.target.value)}>
            {outros.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.supervisor ? ` (${p.supervisor})` : ''}</option>)}
          </select>
        </Confirmar>
      )}
      {modal === 'convenio' && (
        <Confirmar titulo="Excluir por convênio" texto={`Remove os clientes de ${promotor.nome} que pertencem ao convênio escolhido. Esta ação não pode ser desfeita.`} rotuloBotao="Excluir" pendente={excluir.isPending} onConfirmar={() => excluir.mutate(convenioExcluir)} onClose={() => setModal(null)}>
          <label className="label mt-4" htmlFor="conv-ex">Convênio</label>
          <select id="conv-ex" className="input" value={convenioExcluir} onChange={(e) => setConvenioExcluir(e.target.value)}>
            {conveniosDoPromotor.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Confirmar>
      )}
      {modal === 'tudo' && (
        <Confirmar titulo="Excluir todos os clientes" texto={`Isso remove os ${todos?.total ?? 0} cliente(s) de ${promotor.nome}, de todos os convênios. Esta ação não pode ser desfeita.`} rotuloBotao="Excluir todos" pendente={excluir.isPending} onConfirmar={() => excluir.mutate('')} onClose={() => setModal(null)} />
      )}

      {aberta && (
        <OportunidadeModal
          key={aberta.id}
          oportunidade={aberta}
          podeAtribuir
          onClose={() => setAberta(null)}
          onSalvar={async (payload) => {
            await api(`/oportunidades/${aberta.id}`, { method: 'PUT', body: payload });
            toast.sucesso('Alterações salvas.');
            qc.invalidateQueries({ queryKey: ['/promotores'] });
            qc.invalidateQueries({ queryKey: ['/oportunidades'] });
          }}
          onExcluir={async () => {
            await api(`/oportunidades/${aberta.id}`, { method: 'DELETE' });
            toast.sucesso('Cliente excluído.');
            qc.invalidateQueries({ queryKey: ['/promotores'] });
          }}
        />
      )}
    </>
  );
}

// ---------------- Página ----------------
export default function Promotores() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const master = usuario.perfil === 'MASTER';
  const [visao, setVisao] = useState('geral'); // geral | lista | detalhe
  const [mes, setMes] = useState('');
  const [selecionado, setSelecionado] = useState(null);
  const [liberando, setLiberando] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['/promotores', 'resumo', mes],
    queryFn: () => api(`/promotores/resumo${mes ? `?mes=${mes}` : ''}`),
    refetchInterval: 30_000,
  });

  // Se o mês escolhido deixou de existir (clientes excluídos), volta para "todos"
  const meses = data?.meses ?? [];
  const mesAtual = mes && meses.some((m) => m.mes === mes) ? mes : '';

  const { data: perdidos } = useQuery({
    queryKey: ['/promotores', 'perdidos'],
    queryFn: () => api('/promotores/perdidos/contagem'),
    enabled: master && liberando,
  });
  const liberar = useMutation({
    mutationFn: () => api('/promotores/liberar-perdidos', { method: 'POST' }),
    onSuccess: (r) => {
      toast.sucesso(`${r.liberados} cliente(s) perdido(s) liberado(s).`);
      setLiberando(false);
      qc.invalidateQueries({ queryKey: ['/promotores'] });
      qc.invalidateQueries({ queryKey: ['/oportunidades'] });
    },
    onError: (e) => toast.erro(e.message),
  });

  const titulos = {
    geral: ['Promotores', 'Os clientes que estão com a equipe de vendas, por convênio.'],
    lista: [master ? 'Todos os promotores' : 'Promotores', 'Quanto cada promotor está trabalhando, por estágio.'],
    detalhe: [selecionado?.nome ?? 'Promotor', 'Clientes deste promotor.'],
  };

  return (
    <>
      <PageHeader titulo={titulos[visao][0]} descricao={titulos[visao][1]}>
        {meses.length > 0 && (
          <label className="flex items-center gap-2" title="Filtra pelo mês em que o cliente foi atualizado">
            <CalendarDays size={16} className="text-accent" />
            <select className={`input !w-auto ${mesAtual ? '!border-accent/60 !text-accent' : ''}`} value={mesAtual} onChange={(e) => setMes(e.target.value)} aria-label="Filtrar por mês">
              <option value="">Todos os meses</option>
              {meses.map((m) => <option key={m.mes} value={m.mes}>{rotuloMes(m.mes)} ({m.total})</option>)}
            </select>
          </label>
        )}
        {visao !== 'detalhe' && (
          <div className="flex rounded-xl bg-surface2 p-1">
            {[['geral', 'Visão geral'], ['lista', 'Promotores']].map(([v, rotulo]) => (
              <button key={v} onClick={() => setVisao(v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${visao === v ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-fg'}`}>
                {rotulo}
              </button>
            ))}
          </div>
        )}
        {master && visao === 'geral' && (
          <button className="btn-outline" onClick={() => setLiberando(true)}>
            <Unlock size={15} className="text-amber-500" /> Liberar perdidos
          </button>
        )}
      </PageHeader>

      {error && <p className="mb-3 text-sm text-primary">{error.message}</p>}
      {isLoading && <CartoesSkeleton quantidade={3} />}

      {data && visao === 'geral' && (
        <>
          <p className="num mb-4 text-xs text-muted">{data.convenios.length} convênio{data.convenios.length === 1 ? '' : 's'} · {data.totalClientes} cliente{data.totalClientes === 1 ? '' : 's'}</p>
          <VisaoGeral convenios={data.convenios} />
        </>
      )}
      {data && visao === 'lista' && (
        <ListaPromotores promotores={data.promotores} master={master} onAbrir={(p) => { setSelecionado(p); setVisao('detalhe'); }} />
      )}
      {data && visao === 'detalhe' && selecionado && (
        <DetalhePromotor key={selecionado.id} promotor={selecionado} promotores={data.promotores} mes={mesAtual} onVoltar={() => setVisao('lista')} />
      )}

      {liberando && (
        <Confirmar
          titulo="Liberar clientes perdidos"
          texto={perdidos ? `Existem ${perdidos.total} cliente(s) perdido(s) com promotores, em todas as equipes. Liberar remove esses clientes do funil dos promotores, para que possam ser trabalhados de novo. Não pode ser desfeito.` : 'Contando clientes perdidos…'}
          rotuloBotao="Liberar perdidos"
          pendente={liberar.isPending || !perdidos || perdidos.total === 0}
          onConfirmar={() => liberar.mutate()}
          onClose={() => setLiberando(false)}
        />
      )}
    </>
  );
}
