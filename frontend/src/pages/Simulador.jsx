import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Loader2, Save, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { dataHoraBR, moeda } from '../lib/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import { Carregando , EstadoVazio } from '../components/Estados.jsx';

const pct = (v) => `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const LINHAS = {
  financiamento_imobiliario: [
    { r: 'Financiamento a ser liberado', f: (b) => moeda(b.financiamentoLiberado), forte: true },
    { r: 'Despesas', f: (b) => moeda(b.despesas) },
    { r: 'Vistoria', f: (b) => `${b.vistoriaSomada ? '+ ' : '(não somada) '}${moeda(b.vistoria)}` },
    { r: 'Valor total financiado', f: (b) => moeda(b.totalFinanciado), forte: true },
    { r: 'Entrada', f: (b) => moeda(b.entrada) },
    { r: 'Prazo', f: (b) => `${b.prazo} meses` },
    { r: 'Renda aproximada', f: (b) => moeda(b.rendaAproximada) },
    { r: 'Primeira parcela', f: (b) => moeda(b.primeiraParcela), forte: true },
    { r: 'Última parcela', f: (b) => moeda(b.ultimaParcela) },
    { r: 'Taxa efetiva (a.a.)', f: (b) => pct(b.taxaEfetiva) },
    { r: 'CET (a.a.)', f: (b) => pct(b.cet) },
  ],
  home_equity: [
    { r: 'Empréstimo liberado', f: (b) => moeda(b.emprestimoBruto), forte: true },
    { r: 'Avaliação do imóvel', f: (b) => moeda(b.avaliacao) },
    { r: 'IOF', f: (b) => moeda(b.iof) },
    { r: 'Valor total financiado', f: (b) => moeda(b.totalFinanciado), forte: true },
    { r: 'Prazo', f: (b) => `${b.prazo} meses` },
    { r: 'Renda aproximada', f: (b) => moeda(b.rendaAproximada) },
    { r: 'Primeira parcela', f: (b) => moeda(b.primeiraParcela), forte: true },
    { r: 'Última parcela', f: (b) => moeda(b.ultimaParcela) },
    { r: 'Taxa mensal', f: (b) => pct(b.taxaMensal) },
    { r: 'Taxa efetiva (a.a.)', f: (b) => pct(b.taxaEfetivaAnual) },
    { r: 'CET (a.a.)', f: (b) => pct(b.cet) },
  ],
};

function Comparativo({ tipo, resultado }) {
  const bancos = Object.entries(resultado);
  const menor = Math.min(...bancos.map(([, b]) => b.primeiraParcela));

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface2">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted" />
              {bancos.map(([chave, b]) => (
                <th key={chave} className="px-4 py-3 text-center font-semibold">
                  {b.nome}
                  {b.limitado && <span className="mt-0.5 block text-[10px] font-medium text-amber-600 dark:text-amber-400">LTV limitado</span>}
                  {b.primeiraParcela === menor && (
                    <span className="mt-0.5 block text-[10px] font-medium text-emerald-600 dark:text-emerald-400">menor parcela</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {LINHAS[tipo].map((l) => (
              <tr key={l.r} className={l.forte ? 'bg-primary/5' : ''}>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{l.r}</td>
                {bancos.map(([chave, b]) => (
                  <td key={chave} className={`whitespace-nowrap px-4 py-2.5 text-center ${l.forte ? 'font-semibold' : ''}`}>
                    {l.f(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Campo({ rotulo, id, children }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{rotulo}</label>
      {children}
    </div>
  );
}

function Simular({ tipo, config }) {
  const qc = useQueryClient();
  const he = tipo === 'home_equity';
  const bancos = he ? config.homeEquity : config.financiamento;

  const [form, setForm] = useState({
    cliente: '',
    cpf: '',
    valorImovel: '',
    valor: '',
    prazo: he ? '240' : '420',
    sistema: 'SAC',
    opcA: he, // financiamento: incluir despesas (5%) | home equity: avaliação
    opcB: he, // home equity: IOF
  });
  const [taxas, setTaxas] = useState(() =>
    Object.fromEntries(bancos.filter((b) => b.taxas).map((b) => [b.chave, b.taxas[0]])),
  );
  const [resultado, setResultado] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    setSalvo(false);
  };

  const payload = () => ({
    tipo,
    cliente: form.cliente || undefined,
    cpf: form.cpf || undefined,
    valorImovel: Number(form.valorImovel),
    prazo: Number(form.prazo),
    sistema: form.sistema,
    taxas,
    ...(he
      ? { valorEmprestimo: Number(form.valor), incluirAvaliacao: form.opcA, incluirIOF: form.opcB }
      : { valorFinanciado: Number(form.valor), incluirDespesas: form.opcA }),
  });

  const calcular = useMutation({
    mutationFn: () => api('/imobiliario/simulacoes/calcular', { method: 'POST', body: payload() }),
    onSuccess: (r) => {
      setResultado(r.resultado);
      setErro('');
      setSalvo(false);
    },
    onError: (e) => setErro(e.message),
  });

  const salvar = useMutation({
    mutationFn: () => api('/imobiliario/simulacoes', { method: 'POST', body: payload() }),
    onSuccess: () => {
      setSalvo(true);
      qc.invalidateQueries({ queryKey: ['/imobiliario/simulacoes'] });
    },
    onError: (e) => setErro(e.message),
  });

  const maxLtv = Math.max(...bancos.map((b) => b.maxLTV));

  return (
    <div className="space-y-5">
      <form
        className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          calcular.mutate();
        }}
      >
        <Campo rotulo="Cliente (opcional)" id="cliente">
          <input id="cliente" className="input" value={form.cliente} onChange={set('cliente')} />
        </Campo>
        <Campo rotulo="CPF (opcional)" id="cpf">
          <input id="cpf" className="input" value={form.cpf} onChange={set('cpf')} />
        </Campo>
        <Campo rotulo="Valor do imóvel (R$)" id="valorImovel">
          <input id="valorImovel" type="number" min="1" step="any" required className="input" value={form.valorImovel} onChange={set('valorImovel')} />
        </Campo>
        <Campo rotulo={he ? 'Valor do empréstimo (R$)' : 'Valor a financiar (R$)'} id="valor">
          <input id="valor" type="number" min="1" step="any" required className="input" value={form.valor} onChange={set('valor')} />
          {form.valorImovel > 0 && (
            <p className="mt-1 text-xs text-muted">Máximo: {moeda(Number(form.valorImovel) * maxLtv)} ({Math.round(maxLtv * 100)}% do imóvel)</p>
          )}
        </Campo>
        <Campo rotulo="Prazo (meses)" id="prazo">
          <input id="prazo" type="number" min="12" max="480" required className="input" value={form.prazo} onChange={set('prazo')} />
        </Campo>
        <Campo rotulo="Sistema" id="sistema">
          <select id="sistema" className="input" value={form.sistema} onChange={set('sistema')}>
            <option value="SAC">SAC (parcelas decrescentes)</option>
            <option value="PRICE">PRICE (parcelas fixas)</option>
          </select>
        </Campo>

        {bancos.filter((b) => b.taxas).map((b) => (
          <Campo key={b.chave} rotulo={`Taxa ${b.nome} (${he ? '% a.m.' : '% a.a.'})`} id={`taxa-${b.chave}`}>
            <select
              id={`taxa-${b.chave}`}
              className="input"
              value={taxas[b.chave]}
              onChange={(e) => {
                setTaxas((t) => ({ ...t, [b.chave]: Number(e.target.value) }));
                setSalvo(false);
              }}
            >
              {b.taxas.map((t) => (
                <option key={t} value={t}>{t.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</option>
              ))}
            </select>
          </Campo>
        ))}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.opcA} onChange={set('opcA')} className="h-4 w-4 accent-[rgb(var(--primary))]" />
            {he ? 'Incluir avaliação do imóvel' : 'Incluir despesas (5% do imóvel)'}
          </label>
          {he && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.opcB} onChange={set('opcB')} className="h-4 w-4 accent-[rgb(var(--primary))]" />
              Incluir IOF
            </label>
          )}
          {!he && <span className="text-xs text-muted">Inter: taxa fixa de 10,00% a.a. · LTV máximo 75%</span>}
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <button className="btn-primary" disabled={calcular.isPending}>
            {calcular.isPending ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} Simular
          </button>
        </div>
      </form>

      {erro && <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{erro}</p>}

      {resultado && (
        <>
          <Comparativo tipo={tipo} resultado={resultado} />
          <div className="flex items-center gap-3">
            <button className="btn-outline" disabled={salvo || salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {salvo ? 'Simulação salva' : 'Salvar simulação'}
            </button>
            <span className="text-xs text-muted">Taxas e tarifas são estimativas. Confirme com a mesa de crédito.</span>
          </div>
        </>
      )}
    </div>
  );
}

function Salvas() {
  const qc = useQueryClient();
  const [aberta, setAberta] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['/imobiliario/simulacoes'],
    queryFn: () => api('/imobiliario/simulacoes'),
    select: (r) => r.itens,
  });
  const excluir = useMutation({
    mutationFn: (id) => api(`/imobiliario/simulacoes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/imobiliario/simulacoes'] }),
  });

  return (
    <div className="space-y-3">
      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {data?.length === 0 && <div className="card"><EstadoVazio texto="Nenhuma simulação salva." /></div>}

      {data?.map((s) => {
        const bancos = Object.values(s.resultado);
        const menor = Math.min(...bancos.map((b) => b.primeiraParcela));
        const he = s.tipo === 'home_equity';
        return (
          <article key={s.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button className="min-w-0 text-left" onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                <p className="font-semibold">
                  {s.dados.cliente || 'Sem cliente'}
                  <span className="ml-2 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {he ? 'Home equity' : 'Financiamento'}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  Imóvel {moeda(s.dados.valorImovel)} · {he ? moeda(s.dados.valorEmprestimo) : moeda(s.dados.valorFinanciado)} em {s.dados.prazo}x ({s.dados.sistema})
                  · {s.criadorNome} · {dataHoraBR(s.criadoEm)}
                </p>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm">Menor parcela: <strong>{moeda(menor)}</strong></span>
                <button
                  className="btn-ghost !p-2 text-primary"
                  aria-label="Excluir simulação"
                  onClick={() => window.confirm('Excluir esta simulação?') && excluir.mutate(s.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {aberta === s.id && (
              <div className="mt-4">
                <Comparativo tipo={s.tipo} resultado={s.resultado} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default function Simulador() {
  const [aba, setAba] = useState('financiamento_imobiliario');
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['/imobiliario/simulacoes/config'],
    queryFn: () => api('/imobiliario/simulacoes/config'),
    staleTime: Infinity,
  });

  return (
    <>
      <PageHeader titulo="Simulador" descricao="Compare financiamento e home equity entre os bancos." />
      <Tabs
        abas={[
          { valor: 'financiamento_imobiliario', rotulo: 'Financiamento' },
          { valor: 'home_equity', rotulo: 'Home equity' },
          { valor: 'salvas', rotulo: 'Salvas' },
        ]}
        ativa={aba}
        onChange={setAba}
      />
      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {config && (aba === 'salvas' ? <Salvas /> : <Simular key={aba} tipo={aba} config={config} />)}
    </>
  );
}
