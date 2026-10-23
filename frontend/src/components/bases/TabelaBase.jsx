import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Loader2,
  Lock,
  Search,
  Share2,
  Target,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { api, baixarArquivo } from '../../lib/api.js';
import { CAMPOS } from '../../lib/mapeamento.js';
import { dataBR, moeda } from '../../lib/format.js';
import { STATUS_LEAD, formatarCpf } from '../../lib/leads.js';
import { useAuth } from '../../lib/auth.jsx';
import { useEquipe } from '../../lib/useEquipe.js';
import { EstadoVazio, LinhasSkeleton } from '../Estados.jsx';
import DistribuirModal from '../DistribuirModal.jsx';
import Modal from '../Modal.jsx';
import { useToast } from '../Toast.jsx';
import LeadModal from './LeadModal.jsx';
import Situacao from './Situacao.jsx';

const ROTULO_CAMPO = Object.fromEntries(CAMPOS.map((c) => [c.valor, c.rotulo]));
const NUMERICOS = new Set(CAMPOS.filter((c) => c.numero).map((c) => c.valor));
const TAMANHOS = [50, 100, 200];
const CHAVE_COLUNAS = 'procrm.bases.colunas';

const lerColunasSalvas = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_COLUNAS) ?? '[]');
  } catch {
    return [];
  }
};

/** Marca na frente do cliente: livre, meu ou indisponível (só quem gerencia vê com quem está). */
/** "3 d" / "hoje": quanto falta para o cliente voltar a ficar disponível. */
function restam(expiraEm) {
  if (!expiraEm) return null;
  const dias = Math.ceil((new Date(expiraEm).getTime() - Date.now()) / 86400000);
  return dias <= 1 ? 'libera hoje' : `libera em ${dias} d`;
}

function Disponibilidade({ reserva }) {
  if (!reserva) return <span className="text-xs text-muted">Disponível</span>;
  if (reserva.minha) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <Lock size={11} /> Com você{restam(reserva.expiraEm) && <span className="font-normal opacity-80">· {restam(reserva.expiraEm)}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
      <Lock size={11} /> Indisponível{reserva.por ? <span className="font-normal opacity-80">· {reserva.por}</span> : null}
      {reserva.por && restam(reserva.expiraEm) ? <span className="font-normal opacity-70">· {restam(reserva.expiraEm)}</span> : null}
    </span>
  );
}

/**
 * Tabela de dados em tela cheia de uma base (ou de todos os leads).
 * convenio: nome do convênio para filtrar; null = todos.
 */
export default function TabelaBase({ convenio, equipeId = '', qInicial = '', podeAtribuir: podeAtribuirProp, onClose }) {
  const { usuario: eu } = useAuth();
  const master = eu.perfil === 'MASTER';
  const [equipe, setEquipe] = useState(equipeId);
  // As bases das outras equipes são só para consulta: distribuir e atribuir valem na equipe do próprio usuário
  const podeAtribuir = podeAtribuirProp && (!master || equipe === eu.id);
  const qc = useQueryClient();
  const toast = useToast();
  const { usuarios, nomePorId } = useEquipe(podeAtribuirProp);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [matricula, setMatricula] = useState('');
  // A busca vinda de fora (ex.: CPF repetido, busca global) entra na caixa principal
  const [q, setQ] = useState(qInicial);
  const [margemDe, setMargemDe] = useState('');
  const [margemAte, setMargemAte] = useState('');
  const [painel, setPainel] = useState(false);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [status, setStatus] = useState('');
  const [responsavel, setResponsavel] = useState(''); // '' | 'sem' | id
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(100);
  const [ordem, setOrdem] = useState({ campo: 'criadoEm', dir: 'desc' });
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [todosOsResultados, setTodosOsResultados] = useState(false);
  const [extrasVisiveis, setExtrasVisiveis] = useState(() => new Set(lerColunasSalvas()));
  const [seletorColunas, setSeletorColunas] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [distribuindo, setDistribuindo] = useState(false);
  const [acaoStatus, setAcaoStatus] = useState('');
  const [acaoResp, setAcaoResp] = useState('');
  const seletor = useRef(null);

  const filtros = {
    ...(q && { q }),
    ...(master && equipe && { equipeId: equipe }),
    ...(nome && { nome }),
    ...(cpf && { cpf }),
    ...(telefone && { telefone }),
    ...(matricula && { matricula }),
    ...(margemDe && { margemDe }),
    ...(margemAte && { margemAte }),
    ...(de && { de }),
    ...(ate && { ate }),
    ...(status && { statusLead: status }),
    ...(convenio && { convenioNome: convenio }),
    ...(responsavel === 'sem' && { semResponsavel: '1' }),
    ...(responsavel && responsavel !== 'sem' && { funcionarioId: responsavel }),
  };
  const params = new URLSearchParams({ ...filtros, pagina, limite, ordenar: `${ordem.campo}:${ordem.dir}` }).toString();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['/leads', params],
    queryFn: () => api(`/leads?${params}`),
    placeholderData: (anterior) => anterior,
  });

  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  // Esc fecha a tela cheia (se não houver modal por cima)
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && !aberto && !distribuindo && !seletorColunas && onClose();
    window.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = antes;
    };
  }, [aberto, distribuindo, seletorColunas, onClose]);

  useEffect(() => {
    if (!seletorColunas) return undefined;
    const fora = (e) => seletor.current && !seletor.current.contains(e.target) && setSeletorColunas(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [seletorColunas]);

  // Mudou o filtro: volta à primeira página e limpa a seleção
  const limparSelecao = () => {
    setSelecionados(new Set());
    setTodosOsResultados(false);
  };
  const mudarFiltro = (fn) => (e) => {
    fn(e.target.value);
    setPagina(1);
    limparSelecao();
  };

  // Colunas extras: tudo o que veio da planilha e existe nesta página
  const extras = useMemo(() => [...new Set(itens.flatMap((l) => Object.keys(l.dados ?? {})))].sort(), [itens]);
  const alternarExtra = (k) => {
    setExtrasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(k)) novo.delete(k);
      else novo.add(k);
      try {
        localStorage.setItem(CHAVE_COLUNAS, JSON.stringify([...novo]));
      } catch {
        /* sem localStorage */
      }
      return novo;
    });
  };

  const colunas = [
    {
      id: 'reserva',
      rotulo: 'Disponibilidade',
      celula: (l) => <Disponibilidade reserva={l.reserva} />,
    },
    { id: 'nome', rotulo: 'Nome', ordenavel: true, celula: (l) => <span className="font-medium">{l.nome ?? '—'}</span> },
    { id: 'cpf', rotulo: 'CPF', ordenavel: true, celula: (l) => <span className="num">{formatarCpf(l.cpf)}</span> },
    { id: 'telefone', rotulo: 'Telefone', ordenavel: true, celula: (l) => <span className="num">{l.telefone ?? '—'}</span> },
    ...(master && !equipe ? [{ id: 'equipe', rotulo: 'Equipe', celula: (l) => <span className="text-muted">{nomePorId[l.donoId] ?? '—'}</span> }] : []),
    ...(convenio ? [] : [{ id: 'convenio', rotulo: 'Convênio', ordenavel: true, celula: (l) => l.convenio ?? '—' }]),
    { id: 'matricula', rotulo: 'Matrícula', celula: (l) => <span className="num">{l.matricula ?? '—'}</span> },
    { id: 'margem', rotulo: 'Margem livre', celula: (l) => <span className="num">{l.margem ? moeda(l.margem) : '—'}</span> },
    ...(podeAtribuir
      ? [{ id: 'resp', rotulo: 'Responsável', celula: (l) => <span className="text-muted">{l.funcionarioId ? nomePorId[l.funcionarioId] ?? '—' : 'Sem responsável'}</span> }]
      : []),
    { id: 'statusLead', rotulo: 'Situação', ordenavel: true, celula: (l) => <Situacao status={l.statusLead} /> },
    { id: 'criadoEm', rotulo: 'Importado', ordenavel: true, celula: (l) => <span className="num text-muted">{dataBR(l.criadoEm)}</span> },
    ...[...extrasVisiveis]
      .filter((k) => extras.includes(k))
      .map((k) => ({
        id: `x:${k}`,
        rotulo: ROTULO_CAMPO[k] ?? k,
        celula: (l) => {
          const v = l.dados?.[k];
          if (v === undefined || v === null) return <span className="text-muted">—</span>;
          return <span className="num">{NUMERICOS.has(k) && typeof v === 'number' ? moeda(v) : String(v)}</span>;
        },
      })),
  ];

  const ordenarPor = (campo) => {
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }));
    setPagina(1);
  };

  // ---- seleção ----
  const idsPagina = itens.filter((l) => !l.reserva).map((l) => l.id);
  const paginaToda = idsPagina.length > 0 && idsPagina.every((id) => selecionados.has(id));
  const alternarPagina = () => {
    setTodosOsResultados(false);
    setSelecionados((s) => {
      const novo = new Set(s);
      if (paginaToda) idsPagina.forEach((id) => novo.delete(id));
      else idsPagina.forEach((id) => novo.add(id));
      return novo;
    });
  };
  const alternarUm = (id) => {
    setTodosOsResultados(false);
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };
  const qtdSelecionada = todosOsResultados ? total : selecionados.size;

  // O alvo de uma ação em lote: ids marcados, ou todo o filtro (confirmado pelo usuário)
  const alvo = () => (todosOsResultados ? { filtros, todosDoFiltro: true } : { ids: [...selecionados] });

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['/leads'] });
    qc.invalidateQueries({ queryKey: ['/bases'] });
  };

  const lote = useMutation({
    mutationFn: (corpo) => api('/leads/lote', { method: 'POST', body: { ...alvo(), ...corpo } }),
    onSuccess: (r) => {
      toast.sucesso(`${r.atualizados.toLocaleString('pt-BR')} lead(s) atualizado(s).`);
      setAcaoStatus('');
      setAcaoResp('');
      limparSelecao();
      atualizar();
    },
    onError: (e) => toast.erro(e.message),
  });

  // Master e supervisor escolhem para qual promotor o cliente vai; o promotor envia direto para si
  const [enviando, setEnviando] = useState(false);
  const [destino, setDestino] = useState('');
  const oportunidade = useMutation({
    mutationFn: (responsavelId) =>
      api('/leads/enviar-oportunidade', { method: 'POST', body: { ...alvo(), ...(responsavelId && { responsavelId }) } }),
    onSuccess: (r) => {
      toast.sucesso(`${r.criados.toLocaleString('pt-BR')} cliente(s) enviado(s) para Oportunidades (Novo) e para a carteira${r.ignorados ? ` · ${r.ignorados} indisponível(is), já estavam com alguém` : ''}.`);
      limparSelecao();
      setEnviando(false);
      qc.invalidateQueries({ queryKey: ['/oportunidades'] });
      qc.invalidateQueries({ queryKey: ['/carteira'] });
    },
    onError: (e) => toast.erro(e.message),
  });

  const [exportando, setExportando] = useState(false);
  const exportar = async () => {
    setExportando(true);
    try {
      const p = new URLSearchParams({ ...filtros, ordenar: `${ordem.campo}:${ordem.dir}` }).toString();
      await baixarArquivo(`/leads/exportar?${p}`, `leads${convenio ? `-${convenio.replace(/[^\w]+/g, '_')}` : ''}.csv`);
      toast.sucesso('Exportação concluída.');
    } catch (e) {
      toast.erro(e.message);
    } finally {
      setExportando(false);
    }
  };

  // ---- filtros salvos ----
  const { data: favoritos = [] } = useQuery({
    queryKey: ['/leads-favoritos'],
    queryFn: () => api('/leads-favoritos'),
    select: (r) => r.itens,
  });
  const salvarFavorito = useMutation({
    mutationFn: (rotulo) =>
      api('/leads-favoritos', { method: 'POST', body: { nome: rotulo, filtros: { q, nome, cpf, telefone, matricula, margemDe, margemAte, de, ate, status, responsavel } } }),
    onSuccess: () => {
      toast.sucesso('Filtro salvo.');
      qc.invalidateQueries({ queryKey: ['/leads-favoritos'] });
    },
  });
  const aplicarFavorito = (id) => {
    const f = favoritos.find((x) => x.id === id);
    if (!f) return;
    setQ(f.filtros.q ?? '');
    setNome(f.filtros.nome ?? '');
    setMargemDe(f.filtros.margemDe ?? '');
    setMargemAte(f.filtros.margemAte ?? '');
    setCpf(f.filtros.cpf ?? '');
    setTelefone(f.filtros.telefone ?? '');
    setMatricula(f.filtros.matricula ?? '');
    setDe(f.filtros.de ?? '');
    setAte(f.filtros.ate ?? '');
    setStatus(f.filtros.status ?? '');
    setResponsavel(f.filtros.responsavel ?? '');
    setPagina(1);
    limparSelecao();
  };
  const camposAtivos = [master && equipe, nome, cpf, telefone, matricula, margemDe, margemAte, de, ate, status, responsavel].filter(Boolean).length;
  const filtrosAtivos = Boolean(q ||  nome || cpf || telefone || matricula || de || ate || status || responsavel);
  const limparFiltros = () => {
    [setQ, setNome, setCpf, setTelefone, setMatricula, setMargemDe, setMargemAte, setDe, setAte, setStatus, setResponsavel].forEach((f) => f(''));
    setPagina(1);
    limparSelecao();
  };
  const soNumerosVirgula = (set) => (e) => {
    // aceita o sinal de menos só na frente (margem negativa)
    set(e.target.value.replace(/[^0-9.,-]/g, '').replace(/(?!^)-/g, ''));
    setPagina(1);
    limparSelecao();
  };
  const soDigitos = (set) => (e) => {
    set(e.target.value.replace(/[^0-9]/g, ''));
    setPagina(1);
    limparSelecao();
  };

  const IconeOrdem = ({ id }) =>
    ordem.campo !== id ? <ArrowUpDown size={12} className="opacity-40" /> : ordem.dir === 'asc' ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />;

  return createPortal(
    <div className="fixed inset-0 z-40 flex animate-fade-in flex-col overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={convenio ?? 'Todos os leads'}>
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface/70 px-4 py-3 backdrop-blur-2xl lg:px-6">
        <button className="btn-outline !p-2" onClick={onClose} aria-label="Voltar para as bases">
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="kicker">{convenio ? 'Base' : 'Todos os leads'}</p>
          <h2 className="truncate text-base font-semibold">{convenio ?? 'Leads de todas as bases'}</h2>
        </div>
        <div className="num ml-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
          {total.toLocaleString('pt-BR')} registros
        </div>
        {isFetching && <Loader2 size={16} className="animate-spin text-muted" />}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn-outline" onClick={exportar} disabled={exportando || total === 0}>
            {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exportar CSV
          </button>
          {podeAtribuir && (
            <button className="btn-primary" onClick={() => setDistribuindo(true)}>
              <Share2 size={15} /> Distribuir
            </button>
          )}
          <button className="btn-ghost !p-2" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface/40 px-4 py-3 backdrop-blur lg:px-6">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
          <input className="input pl-9" placeholder="Nome, CPF ou telefone…" value={q} onChange={mudarFiltro(setQ)} />
        </div>
        <button
          className={`btn-outline ${painel || camposAtivos ? '!border-accent/60 !text-accent' : ''}`}
          onClick={() => setPainel((v) => !v)}
          aria-expanded={painel}
        >
          <SlidersHorizontal size={15} /> Filtros
          {camposAtivos > 0 && <span className="num rounded-full bg-accent/20 px-1.5 text-[10px] text-accent">{camposAtivos}</span>}
        </button>
        {filtrosAtivos && (
          <button className="btn-ghost text-primary" onClick={limparFiltros}>
            <X size={14} /> Limpar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {favoritos.length > 0 && (
            <select className="input !w-auto" value="" onChange={(e) => aplicarFavorito(e.target.value)} aria-label="Filtros salvos">
              <option value="">Filtros salvos…</option>
              {favoritos.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          )}
          <button
            className="btn-outline"
            disabled={!filtrosAtivos}
            title={filtrosAtivos ? 'Salvar os filtros atuais' : 'Aplique algum filtro para salvar'}
            onClick={() => {
              const nome = window.prompt('Nome do filtro:');
              if (nome?.trim()) salvarFavorito.mutate(nome.trim());
            }}
          >
            <Star size={15} /> Salvar filtro
          </button>

          <div ref={seletor} className="relative">
            <button className="btn-outline" onClick={() => setSeletorColunas((v) => !v)} aria-expanded={seletorColunas}>
              <Columns3 size={15} /> Colunas
              {extrasVisiveis.size > 0 && <span className="num rounded-full bg-accent/20 px-1.5 text-[10px] text-accent">+{extrasVisiveis.size}</span>}
            </button>
            {seletorColunas && (
              <div className="card absolute right-0 z-30 mt-2 max-h-80 w-64 animate-scale-in overflow-y-auto p-2 shadow-lift">
                <p className="kicker px-2 pb-1 pt-1">Dados da planilha</p>
                {extras.length === 0 && <p className="px-2 py-3 text-xs text-muted">Esta página não tem colunas extras.</p>}
                {extras.map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface2">
                    <input type="checkbox" checked={extrasVisiveis.has(k)} onChange={() => alternarExtra(k)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                    {ROTULO_CAMPO[k] ?? k}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {painel && (
        <div className="grid animate-scale-in gap-4 border-b border-line bg-surface/40 px-4 py-4 backdrop-blur sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
          {master && (
            <div>
              <label className="label" htmlFor="tb-eq">Equipe</label>
              <select id="tb-eq" className="input" value={equipe} onChange={mudarFiltro(setEquipe)}>
                <option value="">Todas as equipes</option>
                {usuarios.filter((u) => ['SUPERVISOR', 'MASTER'].includes(u.perfil)).map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="tb-nome">Nome</label>
            <input id="tb-nome" className="input" value={nome} onChange={mudarFiltro(setNome)} />
          </div>
          <div>
            <label className="label" htmlFor="tb-cpf">CPF</label>
            <input id="tb-cpf" className="input num" inputMode="numeric" value={cpf} onChange={soDigitos(setCpf)} />
          </div>
          <div>
            <label className="label" htmlFor="tb-tel">Telefone</label>
            <input id="tb-tel" className="input num" inputMode="numeric" value={telefone} onChange={soDigitos(setTelefone)} />
          </div>
          <div>
            <label className="label" htmlFor="tb-mat">Matrícula</label>
            <input id="tb-mat" className="input num" value={matricula} onChange={mudarFiltro(setMatricula)} />
          </div>
          <div>
            <label className="label" htmlFor="tb-sit">Situação</label>
            <select id="tb-sit" className="input" value={status} onChange={mudarFiltro(setStatus)}>
              <option value="">Todas</option>
              {STATUS_LEAD.map((s) => (
                <option key={s.valor} value={s.valor}>{s.rotulo}</option>
              ))}
            </select>
          </div>
          {podeAtribuir && (
            <div>
              <label className="label" htmlFor="tb-resp">Responsável</label>
              <select id="tb-resp" className="input" value={responsavel} onChange={mudarFiltro(setResponsavel)}>
                <option value="">Todos</option>
                <option value="sem">Sem responsável</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="tb-mde">Margem livre — de</label>
            <input id="tb-mde" className="input num" placeholder="Ex.: -500 ou 1.000,50" value={margemDe} onChange={soNumerosVirgula(setMargemDe)} />
          </div>
          <div>
            <label className="label" htmlFor="tb-mate">Margem livre — até</label>
            <input id="tb-mate" className="input num" placeholder="Sem limite" value={margemAte} onChange={soNumerosVirgula(setMargemAte)} />
          </div>
          <div>
            <label className="label" htmlFor="tb-de">Importado de</label>
            <input id="tb-de" type="date" className="input num" value={de} onChange={mudarFiltro(setDe)} />
          </div>
          <div>
            <label className="label" htmlFor="tb-ate">Importado até</label>
            <input id="tb-ate" type="date" className="input num" value={ate} onChange={mudarFiltro(setAte)} />
          </div>
        </div>
      )}

      {/* Faixa "selecionar todos os resultados" */}
      {paginaToda && total > itens.length && (
        <div className="flex animate-fade-in items-center justify-center gap-3 border-b border-line bg-accent/10 px-4 py-2 text-sm">
          {todosOsResultados ? (
            <>
              <span>Todos os <strong className="num">{total.toLocaleString('pt-BR')}</strong> resultados do filtro estão selecionados.</span>
              <button className="font-medium text-accent hover:underline" onClick={limparSelecao}>Limpar seleção</button>
            </>
          ) : (
            <>
              <span><strong className="num">{itens.length}</strong> desta página selecionados.</span>
              <button className="font-medium text-accent hover:underline" onClick={() => setTodosOsResultados(true)}>
                Selecionar todos os {total.toLocaleString('pt-BR')} resultados
              </button>
            </>
          )}
        </div>
      )}

      {/* Tabela */}
      <div className="min-h-[26rem] flex-1 overflow-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="sticky top-0 z-10 bg-surface/95 text-xs backdrop-blur">
            <tr className="border-b border-line">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={paginaToda}
                  onChange={alternarPagina}
                  aria-label="Selecionar a página"
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
              </th>
              {colunas.map((c) => (
                <th key={c.id} className="whitespace-nowrap px-4 py-3">
                  {c.ordenavel ? (
                    <button className="kicker inline-flex items-center gap-1.5 hover:text-fg" onClick={() => ordenarPor(c.id)}>
                      {c.rotulo} <IconeOrdem id={c.id} />
                    </button>
                  ) : (
                    <span className="kicker">{c.rotulo}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {itens.map((l) => {
              const marcado = todosOsResultados || selecionados.has(l.id);
              return (
                <tr
                  key={l.id}
                  onClick={() => setAberto(l)}
                  className={`cursor-pointer transition-colors ${marcado ? 'bg-accent/10' : 'hover:bg-surface2/60'}`}
                >
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={todosOsResultados || Boolean(l.reserva)}
                      title={l.reserva ? 'Cliente indisponível' : undefined}
                      onChange={() => alternarUm(l.id)}
                      aria-label={`Selecionar ${l.nome ?? 'lead'}`}
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                  </td>
                  {colunas.map((c) => (
                    <td key={c.id} className="whitespace-nowrap px-4 py-2.5">{c.celula(l)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading && <LinhasSkeleton colunas={7} linhas={8} />}
        {error && <p className="p-8 text-center text-sm text-primary">{error.message}</p>}
        {!isLoading && itens.length === 0 && (
          <EstadoVazio texto="Nenhum lead encontrado" dica={filtrosAtivos ? 'Ajuste ou limpe os filtros.' : 'Esta base ainda não tem registros.'} />
        )}
      </div>

      {/* Rodapé: paginação */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/70 px-4 py-2.5 text-sm backdrop-blur-2xl lg:px-6">
        <div className="flex items-center gap-2 text-muted">
          <span>Linhas por página</span>
          <select className="input !w-auto !py-1" value={limite} onChange={(e) => { setLimite(Number(e.target.value)); setPagina(1); limparSelecao(); }}>
            {TAMANHOS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="num flex items-center gap-2 text-muted">
          <span>
            {total ? ((pagina - 1) * limite + 1).toLocaleString('pt-BR') : 0}–{Math.min(pagina * limite, total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
          </span>
          <button className="btn-outline !p-1.5" disabled={pagina <= 1} onClick={() => { setPagina(pagina - 1); limparSelecao(); }} aria-label="Página anterior">
            <ChevronLeft size={16} />
          </button>
          <span>{pagina}/{totalPaginas}</span>
          <button className="btn-outline !p-1.5" disabled={pagina >= totalPaginas} onClick={() => { setPagina(pagina + 1); limparSelecao(); }} aria-label="Próxima página">
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>

      {/* Barra de ações em lote */}
      {qtdSelecionada > 0 && (
        <div className="glow-border fixed inset-x-3 bottom-16 z-50 mx-auto flex max-w-4xl animate-slide-left flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-lift">
          <span className="num rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
            {qtdSelecionada.toLocaleString('pt-BR')} selecionado{qtdSelecionada > 1 ? 's' : ''}
          </span>

          <div className="flex items-center gap-1.5">
            <select className="input !w-auto !py-1.5" value={acaoStatus} onChange={(e) => setAcaoStatus(e.target.value)} aria-label="Nova situação">
              <option value="">Situação…</option>
              {STATUS_LEAD.map((s) => (
                <option key={s.valor} value={s.valor}>{s.rotulo}</option>
              ))}
            </select>
            <button className="btn-outline !py-1.5" disabled={!acaoStatus || lote.isPending} onClick={() => lote.mutate({ statusLead: acaoStatus })}>
              Aplicar
            </button>
          </div>

          {podeAtribuir && (
            <div className="flex items-center gap-1.5">
              <select className="input !w-auto !py-1.5" value={acaoResp} onChange={(e) => setAcaoResp(e.target.value)} aria-label="Novo responsável">
                <option value="">Responsável…</option>
                <option value="__nenhum">Sem responsável</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <button
                className="btn-outline !py-1.5"
                disabled={!acaoResp || lote.isPending}
                onClick={() => lote.mutate({ funcionarioId: acaoResp === '__nenhum' ? null : acaoResp })}
              >
                Atribuir
              </button>
            </div>
          )}

          {/* As bases de outras equipes são só para consulta do master */}
          {(!master || equipe === eu.id) && (
            <button
              className="btn-outline !py-1.5"
              disabled={oportunidade.isPending}
              onClick={() => (podeAtribuirProp ? setEnviando(true) : oportunidade.mutate())}
            >
              {oportunidade.isPending ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />} Enviar para oportunidades
            </button>
          )}

          <button className="btn-ghost ml-auto !py-1.5" onClick={limparSelecao}>
            <X size={14} /> Limpar
          </button>
        </div>
      )}

      {enviando && (
        <Modal titulo="Enviar para oportunidades" onClose={() => setEnviando(false)} largura="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {qtdSelecionada.toLocaleString('pt-BR')} cliente(s) viram oportunidades no estágio <strong className="text-text">Novo</strong> e entram na carteira.
              Quem já estiver com alguém é ignorado.
            </p>
            <div>
              <label className="label" htmlFor="destino-op">Para quem enviar</label>
              <select id="destino-op" className="input" value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Manter o responsável atual (ou eu, se não tiver)</option>
                <option value={eu.id}>Eu mesmo</option>
                {usuarios
                  .filter((u) => u.perfil === 'PROMOTOR' && u.superiorId === eu.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-muted">O promotor escolhido recebe um aviso com a quantidade de clientes.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEnviando(false)}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={oportunidade.isPending} onClick={() => oportunidade.mutate(destino)}>
                {oportunidade.isPending ? <Loader2 size={15} className="animate-spin" /> : <Target size={15} />} Enviar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {aberto && <LeadModal lead={aberto} podeAtribuir={podeAtribuir} onClose={() => setAberto(null)} />}

      {distribuindo && (
        <DistribuirModal
          titulo={convenio ? `Distribuir: ${convenio}` : 'Distribuir leads'}
          descricao="Os leads sem responsável são repartidos em rodízio entre os promotores marcados."
          origens={[{ valor: convenio ?? '', rotulo: convenio ? `${convenio} (sem responsável)` : 'Todos os leads sem responsável' }]}
          onClose={() => {
            setDistribuindo(false);
            atualizar();
          }}
          onDistribuir={({ usuarioIds, quantidade, origem }) =>
            api('/leads/distribuir', { method: 'POST', body: { usuarioIds, quantidade, ...(origem ? { convenio: origem } : {}) } })
          }
        />
      )}
    </div>,
    document.body,
  );
}
