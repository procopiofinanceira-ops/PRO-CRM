import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ExternalLink, Loader2, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { dataBR, dataHoraBR } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import { Carregando } from '../components/Estados.jsx';

function ResumoDia({ supervisor, onClose }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const { data: r, isLoading, error } = useQuery({
    queryKey: ['/painel/dia', supervisor.id, data],
    queryFn: () => api(`/painel/supervisores/${supervisor.id}/dia?data=${data}`),
  });

  const linhas = r && [
    ['Contatos criados', r.contatosCriados],
    ['Oportunidades criadas', r.oportunidadesCriadas],
    ['Oportunidades atualizadas', r.oportunidadesAtualizadas],
    ['Leads trabalhados', r.leadsTrabalhados],
    ['Propostas imobiliárias criadas', r.propostasCriadas],
    ['Propostas imobiliárias atualizadas', r.propostasAtualizadas],
  ];

  return (
    <Modal titulo={`Resumo do dia: ${supervisor.nome}`} onClose={onClose}>
      <div className="mb-4 max-w-[12rem]">
        <label className="label" htmlFor="dia">Data</label>
        <input id="dia" type="date" className="input" max={hoje} value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
      </div>
      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {linhas && (
        <dl className="grid grid-cols-2 gap-3">
          {linhas.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface2 p-3">
              <dd className="text-xl font-semibold">{v}</dd>
              <dt className="text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      )}
    </Modal>
  );
}

function Supervisores({ master }) {
  const { entrarComo } = useAuth();
  const navigate = useNavigate();
  const [entrando, setEntrando] = useState(null);
  const [dia, setDia] = useState(null);
  const [erro, setErro] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['/painel/supervisores'],
    queryFn: () => api('/painel/supervisores'),
    select: (r) => r.itens,
  });

  const acessar = async (s) => {
    setErro('');
    setEntrando(s.id);
    try {
      await entrarComo(s.id);
      navigate('/');
    } catch (e) {
      setErro(e.message);
      setEntrando(null);
    }
  };

  return (
    <>
      {isLoading && <Carregando />}
      {(error || erro) && <p className="mb-3 text-sm text-primary">{erro || error.message}</p>}
      {data?.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-muted">
          <Users size={32} className="opacity-40" />
          <p className="text-sm font-medium">Nenhum supervisor para acompanhar</p>
          {!master && <p className="text-xs">Peça ao master para associar supervisores ao seu perfil.</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((s) => (
          <article key={s.id} className="card card-hover p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-base font-semibold text-primary">
                {s.nome[0].toUpperCase()}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{s.nome}</h3>
                <p className="truncate text-xs text-muted">{s.email}</p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[['Promotores', s.promotores], ['Oportunidades', s.oportunidades], ['Leads', s.leads]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface2 py-2">
                  <dd className="text-lg font-semibold">{v.toLocaleString('pt-BR')}</dd>
                  <dt className="text-[11px] text-muted">{k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">Último acesso: {s.ultimoLogin ? dataHoraBR(s.ultimoLogin) : 'nunca'}</p>

            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1" disabled={entrando === s.id} onClick={() => acessar(s)}>
                {entrando === s.id ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />} Acessar ambiente
              </button>
              {master && (
                <button className="btn-outline" onClick={() => setDia(s)} aria-label="Resumo do dia" title="Resumo do dia">
                  <CalendarDays size={16} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {dia && <ResumoDia supervisor={dia} onClose={() => setDia(null)} />}
    </>
  );
}

function Tabela({ colunas, linhas, vazio }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
            <tr>
              {colunas.map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {linhas.map((l, i) => (
              <tr key={i}>
                {l.map((c, j) => (
                  <td key={j} className={`whitespace-nowrap px-4 py-3 ${j === 0 ? 'font-medium' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length === 0 && <p className="p-6 text-center text-sm text-muted">{vazio}</p>}
    </div>
  );
}

function useDados(caminho) {
  return useQuery({ queryKey: [caminho], queryFn: () => api(caminho), select: (r) => r.itens });
}

function Ranking() {
  const { data = [], isLoading } = useDados('/painel/ranking');
  return (
    <>
      {isLoading && <Carregando />}
      <Tabela
        colunas={['#', 'Supervisor', 'Promotores', 'Leads', 'Trabalhados', 'Aproveitamento', 'Oportunidades', 'Propostas imob.', 'Último acesso']}
        linhas={data.map((r, i) => [
          i + 1,
          r.nome,
          r.promotores,
          r.leads.toLocaleString('pt-BR'),
          r.leadsTrabalhados.toLocaleString('pt-BR'),
          <span key="a" className="inline-flex items-center gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface2">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${r.aproveitamento}%` }} />
            </span>
            {r.aproveitamento}%
          </span>,
          r.oportunidades,
          r.propostasImob,
          r.ultimoLogin ? dataHoraBR(r.ultimoLogin) : '—',
        ])}
        vazio="Nenhum supervisor ativo."
      />
    </>
  );
}

function Bases() {
  const { data = [], isLoading } = useDados('/painel/bases');
  return (
    <>
      {isLoading && <Carregando />}
      <Tabela
        colunas={['Arquivo', 'Convênio', 'Equipe', 'Leads', 'Duplicados', 'Data']}
        linhas={data.map((b) => [b.arquivo, b.convenio, b.equipe, b.leads.toLocaleString('pt-BR'), b.duplicados.toLocaleString('pt-BR'), dataBR(b.data)])}
        vazio="Nenhuma base importada."
      />
    </>
  );
}

function Convenios() {
  const { data = [], isLoading } = useDados('/painel/convenios');
  return (
    <>
      {isLoading && <Carregando />}
      <Tabela
        colunas={['Convênio', 'Leads', 'Novos', 'Em trabalho', 'Convertidos']}
        linhas={data.map((c) => [c.convenio, c.total.toLocaleString('pt-BR'), c.novos.toLocaleString('pt-BR'), c.emTrabalho.toLocaleString('pt-BR'), c.convertidos.toLocaleString('pt-BR')])}
        vazio="Nenhum convênio com leads."
      />
    </>
  );
}

export default function Gestao() {
  const { usuario } = useAuth();
  const master = usuario.perfil === 'MASTER';
  const [aba, setAba] = useState('supervisores');

  return (
    <>
      <PageHeader
        titulo={master ? 'Gestão' : 'Supervisores'}
        descricao={master ? 'Acompanhe todas as equipes e acesse o ambiente de cada supervisor.' : 'Acesse o ambiente dos supervisores que você acompanha.'}
      />
      {master && (
        <Tabs
          abas={[
            { valor: 'supervisores', rotulo: 'Supervisores' },
            { valor: 'ranking', rotulo: 'Ranking de uso' },
            { valor: 'bases', rotulo: 'Bases importadas' },
            { valor: 'convenios', rotulo: 'Convênios' },
          ]}
          ativa={aba}
          onChange={setAba}
        />
      )}
      {aba === 'supervisores' || !master ? <Supervisores master={master} /> : null}
      {master && aba === 'ranking' && <Ranking />}
      {master && aba === 'bases' && <Bases />}
      {master && aba === 'convenios' && <Convenios />}
    </>
  );
}
