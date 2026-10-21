import { useState } from 'react';
import CrudPage from '../components/CrudPage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import { dataBR, paraInputData } from '../lib/format.js';

const SITUACOES = [
  { valor: 'RASCUNHO', rotulo: 'Rascunho', cor: 'bg-slate-400/20 text-slate-600 dark:text-slate-300' },
  { valor: 'EM_FILA', rotulo: 'Em fila', cor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { valor: 'ENVIANDO', rotulo: 'Enviando', cor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  { valor: 'ENVIADO', rotulo: 'Enviado', cor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { valor: 'CANCELADO', rotulo: 'Cancelado', cor: 'bg-primary/15 text-primary' },
];

const Situacao = ({ valor }) => {
  const s = SITUACOES.find((x) => x.valor === valor);
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s?.cor}`}>{s?.rotulo ?? valor}</span>;
};

const pct = (v) => (v != null ? `${Number(v).toLocaleString('pt-BR')}%` : '—');
const opcoesSituacao = SITUACOES.map((s) => ({ valor: s.valor, rotulo: s.rotulo }));

// ---------- E-mail ----------
const camposEmail = [
  { chave: 'assunto', rotulo: 'Assunto', obrigatorio: true },
  { chave: 'responsavel', rotulo: 'Responsável', largura: 'meia' },
  { chave: 'listaCorreio', rotulo: 'Lista de e-mails', largura: 'meia' },
  { chave: 'situacao', rotulo: 'Situação', tipo: 'select', obrigatorio: true, largura: 'meia', opcoes: opcoesSituacao },
  { chave: 'dataEnvio', rotulo: 'Data do envio', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'enviados', rotulo: 'Enviados', tipo: 'number', largura: 'meia' },
  { chave: 'entreguePct', rotulo: 'Entregues (%)', tipo: 'number', largura: 'meia' },
  { chave: 'abertoPct', rotulo: 'Abertos (%)', tipo: 'number', largura: 'meia' },
  { chave: 'clicadoPct', rotulo: 'Cliques (%)', tipo: 'number', largura: 'meia' },
  { chave: 'respondidoPct', rotulo: 'Respondidos (%)', tipo: 'number', largura: 'meia' },
];
const colunasEmail = [
  { rotulo: 'Assunto', render: (c) => <span className="font-medium">{c.assunto}</span> },
  { rotulo: 'Responsável', chave: 'responsavel' },
  { rotulo: 'Situação', render: (c) => <Situacao valor={c.situacao} /> },
  { rotulo: 'Enviados', chave: 'enviados' },
  { rotulo: 'Abertos', render: (c) => pct(c.abertoPct) },
  { rotulo: 'Cliques', render: (c) => pct(c.clicadoPct) },
  { rotulo: 'Envio', render: (c) => dataBR(c.dataEnvio) },
];

// ---------- SMS ----------
const camposSms = [
  { chave: 'nome', rotulo: 'Nome da campanha', obrigatorio: true },
  { chave: 'listaCorreio', rotulo: 'Lista de contatos', largura: 'meia' },
  { chave: 'situacao', rotulo: 'Situação', tipo: 'select', obrigatorio: true, largura: 'meia', opcoes: opcoesSituacao },
  { chave: 'dataInicio', rotulo: 'Início', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'dataFim', rotulo: 'Fim', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'enviados', rotulo: 'Enviados', tipo: 'number', largura: 'meia' },
  { chave: 'entregues', rotulo: 'Entregues', tipo: 'number', largura: 'meia' },
  { chave: 'abertoPct', rotulo: 'Abertos (%)', tipo: 'number', largura: 'meia' },
  { chave: 'clicadoPct', rotulo: 'Cliques (%)', tipo: 'number', largura: 'meia' },
  { chave: 'respondidoPct', rotulo: 'Respondidos (%)', tipo: 'number', largura: 'meia' },
];
const colunasSms = [
  { rotulo: 'Campanha', render: (c) => <span className="font-medium">{c.nome}</span> },
  { rotulo: 'Situação', render: (c) => <Situacao valor={c.situacao} /> },
  { rotulo: 'Enviados', chave: 'enviados' },
  { rotulo: 'Entregues', chave: 'entregues' },
  { rotulo: 'Respondidos', render: (c) => pct(c.respondidoPct) },
  { rotulo: 'Período', render: (c) => `${dataBR(c.dataInicio)} → ${dataBR(c.dataFim)}` },
];

export default function Marketing() {
  const [aba, setAba] = useState('email');

  return (
    <>
      <PageHeader
        titulo="Marketing"
        descricao="Acompanhe suas campanhas de e-mail e SMS. O envio real será ligado depois."
      />
      <Tabs
        abas={[{ valor: 'email', rotulo: 'E-mail' }, { valor: 'sms', rotulo: 'SMS' }]}
        ativa={aba}
        onChange={setAba}
      />
      {aba === 'email' ? (
        <CrudPage
          embutido
          titulo="Campanha de e-mail"
          endpoint="/email-marketing"
          padrao={{ situacao: 'RASCUNHO' }}
          colunas={colunasEmail}
          campos={camposEmail}
          vazio="Nenhuma campanha de e-mail."
        />
      ) : (
        <CrudPage
          embutido
          titulo="Campanha de SMS"
          endpoint="/sms-marketing"
          padrao={{ situacao: 'RASCUNHO' }}
          colunas={colunasSms}
          campos={camposSms}
          vazio="Nenhuma campanha de SMS."
        />
      )}
    </>
  );
}
