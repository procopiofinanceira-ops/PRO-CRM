import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, LayoutGrid, List, Loader2, Paperclip, Plus, Search, Trash2, Upload } from 'lucide-react';
import { api, baixarArquivo, enviarArquivo } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCrud } from '../lib/useCrud.js';
import { dataBR, dataHoraBR, moeda, paraInputData, paraInputDataHora } from '../lib/format.js';
import FormModal, { paraPayload } from '../components/FormModal.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import { Carregando, EstadoVazio } from '../components/Estados.jsx';
import { useToast } from '../components/Toast.jsx';

const ETAPAS = [
  { valor: 'Proposta criada', cor: 'bg-slate-400' },
  { valor: 'Pré-qualificação', cor: 'bg-sky-500' },
  { valor: 'Análise de crédito', cor: 'bg-violet-500' },
  { valor: 'Processamento e documentos', cor: 'bg-amber-500' },
  { valor: 'Vistoria', cor: 'bg-indigo-500' },
  { valor: 'Análise jurídica', cor: 'bg-orange-500' },
  { valor: 'Contrato', cor: 'bg-teal-500' },
  { valor: 'Registro em cartório', cor: 'bg-cyan-500' },
  { valor: 'Pagamento', cor: 'bg-emerald-500' },
  { valor: 'Proposta reprovada', cor: 'bg-primary' },
];

const BANCOS = ['Itaú', 'Santander', 'Bari', 'Credita', 'Cashme', 'Ponte', 'Tcash', 'Inter', 'Bradesco', 'C6', 'Daycoval'];
const STATUS_BANCO = [
  { valor: 'enviado', rotulo: 'Enviado', cor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  { valor: 'em_analise', rotulo: 'Em análise', cor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { valor: 'aprovado', rotulo: 'Aprovado', cor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { valor: 'reprovado', rotulo: 'Reprovado', cor: 'bg-primary/15 text-primary' },
];

const sim_nao = [{ valor: 'Sim', rotulo: 'Sim' }, { valor: 'Não', rotulo: 'Não' }];
const opcoes = (lista) => lista.map((v) => ({ valor: v, rotulo: v }));

const CAMPOS_BASE = [
  { secao: 'Proposta', chave: 'produto', rotulo: 'Produto', tipo: 'select', obrigatorio: true, largura: 'meia', opcoes: opcoes(['Aquisição', 'Home Equity']) },
  { chave: 'etapa', rotulo: 'Etapa', tipo: 'select', obrigatorio: true, largura: 'meia', opcoes: opcoes(ETAPAS.map((e) => e.valor)) },
  { chave: 'parceiro', rotulo: 'Parceiro', largura: 'meia' },
  { chave: 'consultor', rotulo: 'Consultor', largura: 'meia' },
  { chave: 'proposta', rotulo: 'Nº da proposta', largura: 'meia' },
  { chave: 'aprovacao', rotulo: 'Aprovação', largura: 'meia' },
  { chave: 'modalidade', rotulo: 'Modalidade', largura: 'meia' },
  { chave: 'dataInicio', rotulo: 'Data de início', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'agendamento', rotulo: 'Agendamento', tipo: 'datetime', largura: 'meia', paraInput: paraInputDataHora },

  { secao: 'Cliente', chave: 'cliente', rotulo: 'Nome do cliente', obrigatorio: true },
  { chave: 'cpf', rotulo: 'CPF', largura: 'meia', obrigatorio: true },
  { chave: 'contato', rotulo: 'Telefone', tipo: 'tel', largura: 'meia', obrigatorio: true },
  { chave: 'emailCliente', rotulo: 'E-mail', tipo: 'email', largura: 'meia', obrigatorio: true },
  { chave: 'dataNascimento', rotulo: 'Nascimento', tipo: 'date', largura: 'meia', obrigatorio: true, paraInput: paraInputData },
  { chave: 'cidade', rotulo: 'Cidade', largura: 'meia', obrigatorio: true },
  { chave: 'habitantes', rotulo: 'Habitantes', largura: 'meia' },
  { chave: 'estadoCivil', rotulo: 'Estado civil', tipo: 'select', largura: 'meia',
    opcoes: opcoes(['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)']) },
  { chave: 'situacaoProfissional', rotulo: 'Situação profissional', largura: 'meia' },
  { chave: 'rendaPrincipal', rotulo: 'Renda principal?', tipo: 'select', largura: 'meia', opcoes: sim_nao },
  { chave: 'rendaMensal', rotulo: 'Renda mensal (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'rendaFamiliar', rotulo: 'Renda familiar (R$)', tipo: 'number', largura: 'meia' },

  { secao: 'Cônjuge', chave: 'conjugeNome', rotulo: 'Nome do cônjuge' },
  { chave: 'conjugeCpf', rotulo: 'CPF', largura: 'meia' },
  { chave: 'conjugeCelular', rotulo: 'Celular', tipo: 'tel', largura: 'meia' },
  { chave: 'conjugeEmail', rotulo: 'E-mail', tipo: 'email', largura: 'meia' },
  { chave: 'conjugeNascimento', rotulo: 'Nascimento', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'conjugeRenda', rotulo: 'Renda (R$)', tipo: 'number', largura: 'meia' },

  { secao: 'Crédito', chave: 'valorImovel', rotulo: 'Valor do imóvel (R$)', tipo: 'number', largura: 'meia', obrigatorio: true },
  { chave: 'valorFinanciamentoLiq', rotulo: 'Financiamento líquido (R$)', tipo: 'number', largura: 'meia', obrigatorio: true },
  { chave: 'valorNecessario', rotulo: 'Valor necessário (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'prazoPretendido', rotulo: 'Prazo pretendido', largura: 'meia' },
  { chave: 'analiseCreditoStatus', rotulo: 'Análise de crédito', largura: 'meia' },

  { secao: 'Imóvel em garantia', chave: 'tipoImovelGarantia', rotulo: 'Tipo do imóvel', largura: 'meia' },
  { chave: 'pagandoImovel', rotulo: 'Ainda paga o imóvel?', tipo: 'select', largura: 'meia', opcoes: sim_nao },
  { chave: 'cepImovel', rotulo: 'CEP', largura: 'meia' },
  { chave: 'numeroImovel', rotulo: 'Número', largura: 'meia' },
  { chave: 'complementoImovel', rotulo: 'Complemento', largura: 'meia' },
  { chave: 'matriculaImovel', rotulo: 'Matrícula', largura: 'meia' },
];

const CAMPOS_BANCOS = BANCOS.flatMap((b, i) => [
  { secao: i === 0 ? 'Bancos consultados' : undefined, chave: `st_${i}`, rotulo: `${b}: status`, tipo: 'select', largura: 'meia', opcoes: STATUS_BANCO.map((s) => ({ valor: s.valor, rotulo: s.rotulo })) },
  { chave: `vl_${i}`, rotulo: `${b}: valor aprovado (R$)`, tipo: 'number', largura: 'meia' },
]);

const CAMPOS_OBS = [
  { secao: 'Observações', chave: 'observacao1', rotulo: 'Observação', tipo: 'textarea' },
  { chave: 'observacao2', rotulo: 'Acompanhamento', tipo: 'textarea' },
];

const CAMPOS = [...CAMPOS_BASE, ...CAMPOS_BANCOS, ...CAMPOS_OBS];

function valoresIniciais(p) {
  const v = Object.fromEntries(
    CAMPOS_BASE.concat(CAMPOS_OBS).map((c) => [
      c.chave,
      c.paraInput ? c.paraInput(p[c.chave]) : p[c.chave] ?? (c.chave === 'etapa' ? 'Proposta criada' : ''),
    ]),
  );
  BANCOS.forEach((b, i) => {
    const linha = p.bancos?.find((x) => x.banco === b);
    v[`st_${i}`] = linha?.status ?? '';
    v[`vl_${i}`] = linha?.valorAprovado ?? '';
  });
  return v;
}

function montarPayload(form) {
  const base = paraPayload(CAMPOS_BASE.concat(CAMPOS_OBS), form);
  const bancos = BANCOS.map((banco, i) => ({
    banco,
    status: form[`st_${i}`] || null,
    valorAprovado: form[`vl_${i}`] === '' ? null : Number(form[`vl_${i}`]),
  }));
  return { ...base, bancos };
}

// ---------- Documentos ----------
const tamanho = (b) =>
  !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

function DocumentosModal({ propostaId, onClose }) {
  const qc = useQueryClient();
  const input = useRef(null);
  const [erro, setErro] = useState('');

  const { data: proposta } = useQuery({
    queryKey: ['/imobiliario/propostas', {}],
    queryFn: () => api('/imobiliario/propostas'),
    select: (r) => r.itens.find((p) => p.id === propostaId),
  });

  const atualizar = () => qc.invalidateQueries({ queryKey: ['/imobiliario/propostas'] });

  const enviar = useMutation({
    mutationFn: (arquivo) => enviarArquivo(`/imobiliario/propostas/${propostaId}/documentos`, arquivo),
    onSuccess: () => {
      setErro('');
      atualizar();
    },
    onError: (e) => setErro(e.message),
  });

  const remover = useMutation({
    mutationFn: (id) => api(`/imobiliario/documentos/${id}`, { method: 'DELETE' }),
    onSuccess: atualizar,
  });

  const baixar = async (doc) => {
    try {
      await baixarArquivo(`/imobiliario/documentos/${doc.id}/download`, doc.nome);
    } catch (e) {
      setErro(e.message);
    }
  };

  const docs = proposta?.documentos ?? [];

  return (
    <Modal titulo={`Documentos${proposta ? `: ${proposta.cliente}` : ''}`} onClose={onClose}>
      <div className="space-y-4">
        <button
          className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-line px-4 py-6 text-sm transition hover:border-primary hover:bg-primary/5"
          onClick={() => input.current?.click()}
          disabled={enviar.isPending}
        >
          {enviar.isPending ? <Loader2 className="animate-spin text-primary" /> : <Upload className="text-primary" />}
          <span className="font-medium">Anexar documento</span>
          <span className="text-xs text-muted">PDF, imagem, Word ou Excel, até 20 MB</span>
        </button>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            if (e.target.files?.[0]) enviar.mutate(e.target.files[0]);
            e.target.value = '';
          }}
        />

        {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{erro}</p>}

        {docs.length === 0 ? (
          <p className="text-center text-sm text-muted">Nenhum documento anexado.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <FileText size={18} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.nome}</p>
                  <p className="text-xs text-muted">{tamanho(d.tamanho)} · {dataHoraBR(d.criadoEm)}</p>
                </div>
                <button className="btn-ghost !p-2" onClick={() => baixar(d)} aria-label={`Baixar ${d.nome}`}>
                  <Download size={16} />
                </button>
                <button
                  className="btn-ghost !p-2 text-primary"
                  aria-label={`Remover ${d.nome}`}
                  onClick={() => window.confirm(`Remover "${d.nome}"?`) && remover.mutate(d.id)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// ---------- Cartão / linha ----------
function ChipsBancos({ bancos }) {
  if (!bancos?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {bancos.map((b) => {
        const s = STATUS_BANCO.find((x) => x.valor === b.status);
        return (
          <span key={b.id} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s?.cor ?? 'bg-surface2'}`} title={s?.rotulo}>
            {b.banco}
          </span>
        );
      })}
    </div>
  );
}

// ---------- Quadro ----------
function Quadro({ itens, onAbrir, onDocs, onMover }) {
  const [sobre, setSobre] = useState(null);

  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
      {ETAPAS.map((e) => {
        const coluna = itens.filter((p) => (p.etapa ?? 'Proposta criada') === e.valor);
        const total = coluna.reduce((s, p) => s + Number(p.valorFinanciamentoLiq ?? 0), 0);
        return (
          <section
            key={e.valor}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-surface2/50 p-3 transition ${
              sobre === e.valor ? 'border-primary bg-primary/5' : 'border-line'
            }`}
            onDragOver={(ev) => {
              ev.preventDefault();
              setSobre(e.valor);
            }}
            onDragLeave={() => setSobre(null)}
            onDrop={(ev) => {
              ev.preventDefault();
              setSobre(null);
              onMover(ev.dataTransfer.getData('text/plain'), e.valor);
            }}
          >
            <header className="mb-3 flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${e.cor}`} />
                <h3 className="truncate text-sm font-semibold">{e.valor}</h3>
                <span className="rounded-full bg-surface px-2 text-xs text-muted">{coluna.length}</span>
              </div>
              <span className="shrink-0 text-xs text-muted">{moeda(total)}</span>
            </header>

            <div className="flex min-h-[4rem] flex-col gap-2">
              {coluna.map((p) => (
                <article
                  key={p.id}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData('text/plain', p.id);
                    ev.currentTarget.classList.add('opacity-50', 'rotate-1', 'scale-95');
                  }}
                  onDragEnd={(ev) => ev.currentTarget.classList.remove('opacity-50', 'rotate-1', 'scale-95')}
                  onClick={() => onAbrir(p)}
                  className="card card-hover cursor-grab p-3 active:cursor-grabbing"
                >
                  <p className="text-sm font-medium">{p.cliente}</p>
                  <p className="text-xs text-muted">{[p.produto, p.parceiro].filter(Boolean).join(' · ') || '—'}</p>
                  <p className="mt-2 text-sm font-semibold">{p.valorImovel != null ? moeda(p.valorImovel) : '—'}</p>
                  <ChipsBancos bancos={p.bancos} />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{p.agendamento ? `Agend.: ${dataBR(p.agendamento)}` : ''}</span>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-surface2 hover:text-fg"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDocs(p);
                      }}
                      aria-label="Documentos"
                    >
                      <Paperclip size={13} /> {p.documentos.length}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------- Lista ----------
function Lista({ itens, onAbrir, onDocs }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
            <tr>
              {['Etapa', 'Cliente', 'CPF', 'Parceiro', 'Produto', 'Valor do imóvel', 'Bancos', ''].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {itens.map((p) => (
              <tr key={p.id} className="cursor-pointer transition hover:bg-surface2/60" onClick={() => onAbrir(p)}>
                <td className="whitespace-nowrap px-4 py-3">{p.etapa}</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{p.cliente}</td>
                <td className="whitespace-nowrap px-4 py-3">{p.cpf ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{p.parceiro ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{p.produto ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{p.valorImovel != null ? moeda(p.valorImovel) : '—'}</td>
                <td className="px-4 py-3"><ChipsBancos bancos={p.bancos} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    className="btn-ghost !px-2.5 !py-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDocs(p);
                    }}
                  >
                    <Paperclip size={14} /> {p.documentos.length}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {itens.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhuma proposta encontrada.</p>}
    </div>
  );
}

// ---------- Propostas ----------
function Propostas() {
  const [q, setQ] = useState('');
  const [visao, setVisao] = useState('quadro');
  const [editando, setEditando] = useState(null);
  const [docs, setDocs] = useState(null);
  const { lista, salvar, excluir } = useCrud('/imobiliario/propostas', { q });
  const toast = useToast();
  const itens = lista.data ?? [];

  const mover = (id, etapa) => {
    const atual = itens.find((p) => p.id === id);
    if (atual && atual.etapa !== etapa) salvar.mutate({ id, etapa }, { onError: (e) => toast.erro(e.message) });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Cliente, CPF ou parceiro…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-surface2 p-1">
            {[['quadro', LayoutGrid, 'Quadro'], ['lista', List, 'Lista']].map(([v, Icone, rotulo]) => (
              <button
                key={v}
                onClick={() => setVisao(v)}
                aria-label={rotulo}
                className={`rounded-lg p-2 transition ${visao === v ? 'bg-surface text-primary shadow-card' : 'text-muted'}`}
              >
                <Icone size={16} />
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setEditando({})}>
            <Plus size={16} /> Nova proposta
          </button>
        </div>
      </div>

      {lista.isLoading && <Carregando />}
      {lista.isError && <p className="text-sm text-primary">{lista.error.message}</p>}

      {visao === 'quadro' ? (
        <Quadro itens={itens} onAbrir={setEditando} onDocs={(p) => setDocs(p.id)} onMover={mover} />
      ) : (
        <Lista itens={itens} onAbrir={setEditando} onDocs={(p) => setDocs(p.id)} />
      )}

      {editando && (
        <FormModal
          titulo={editando.id ? `Proposta: ${editando.cliente}` : 'Nova proposta'}
          largura="max-w-3xl"
          campos={CAMPOS}
          valores={valoresIniciais(editando)}
          onClose={() => setEditando(null)}
          onSubmit={(form) => salvar.mutateAsync({ id: editando.id, ...montarPayload(form) })}
          onExcluir={editando.id ? () => excluir.mutateAsync(editando.id) : undefined}
        />
      )}

      {docs && <DocumentosModal propostaId={docs} onClose={() => setDocs(null)} />}
    </>
  );
}

// ---------- Controle de promotores ----------
function Promotores() {
  const [aberto, setAberto] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['/imobiliario/promotores'],
    queryFn: () => api('/imobiliario/promotores'),
    select: (r) => r.itens,
  });
  const { data: propostas = [] } = useQuery({
    queryKey: ['/imobiliario/promotores', aberto?.criadorId ?? 'sem', 'propostas'],
    queryFn: () => api(`/imobiliario/promotores/${aberto.criadorId ?? 'sem'}/propostas`),
    select: (r) => r.itens,
    enabled: Boolean(aberto),
  });

  return (
    <>
      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {data?.length === 0 && <div className="card"><EstadoVazio texto="Nenhuma proposta cadastrada ainda." /></div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((p) => (
          <button key={p.criadorId ?? 'sem'} onClick={() => setAberto(p)} className="card p-5 text-left transition hover:border-primary/40">
            <h3 className="font-semibold">{p.nome}</h3>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {p.total}
              <span className="ml-1.5 text-sm font-normal text-muted">propostas · {moeda(p.valorTotal)}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(p.porEtapa).map(([etapa, n]) => (
                <span key={etapa} className="rounded-full bg-surface2 px-2.5 py-1 text-xs">{etapa}: <strong>{n}</strong></span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {aberto && (
        <Modal titulo={`Propostas de ${aberto.nome}`} onClose={() => setAberto(null)} largura="max-w-2xl">
          <ul className="divide-y divide-line">
            {propostas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{p.cliente}</p>
                  <p className="text-xs text-muted">{p.etapa} · {p.produto ?? '—'}</p>
                </div>
                <span className="font-semibold">{p.valorImovel != null ? moeda(p.valorImovel) : '—'}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}

export default function Imobiliario() {
  const { usuario } = useAuth();
  const gestao = usuario.perfil !== 'PROMOTOR';
  const [aba, setAba] = useState('propostas');

  return (
    <>
      <PageHeader titulo="Imobiliário" descricao="Propostas de financiamento e home equity, do cadastro ao pagamento." />
      {gestao && (
        <Tabs
          abas={[{ valor: 'propostas', rotulo: 'Propostas' }, { valor: 'promotores', rotulo: 'Controle de promotores' }]}
          ativa={aba}
          onChange={setAba}
        />
      )}
      {aba === 'propostas' || !gestao ? <Propostas /> : <Promotores />}
    </>
  );
}
