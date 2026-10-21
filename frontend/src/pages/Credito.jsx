import { useState } from 'react';
import CrudPage from '../components/CrudPage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import { dataBR, moeda } from '../lib/format.js';

const nome = (c) => <span className="font-medium">{c.nome ?? '—'}</span>;
const valor = (v) => (v != null ? moeda(v) : '—');

// ---------- Margens ----------
const camposMargem = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true },
  { chave: 'origem', rotulo: 'Origem', largura: 'meia' },
  { chave: 'margemLivre', rotulo: 'Margem livre (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'ddd', rotulo: 'DDD', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel', largura: 'meia' },
  { chave: 'status', rotulo: 'Status' },
  { chave: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
  { chave: 'mensagemBanco', rotulo: 'Mensagem do banco', tipo: 'textarea' },
];
const colunasMargem = [
  { rotulo: 'Nome', render: nome },
  { rotulo: 'Origem', chave: 'origem' },
  { rotulo: 'Telefone', render: (m) => [m.ddd, m.telefone].filter(Boolean).join(' ') || '—' },
  { rotulo: 'Margem livre', render: (m) => valor(m.margemLivre) },
  { rotulo: 'Status', chave: 'status' },
];

// ---------- Solicitações de margem ----------
const STATUS_SOL = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'em_analise', rotulo: 'Em análise' },
  { valor: 'concluida', rotulo: 'Concluída' },
  { valor: 'recusada', rotulo: 'Recusada' },
];
const camposSolicitacao = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'cpf', rotulo: 'CPF', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel', largura: 'meia' },
  { chave: 'margemLivre', rotulo: 'Margem livre (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'status', rotulo: 'Status', tipo: 'select', obrigatorio: true, largura: 'meia', opcoes: STATUS_SOL },
  { chave: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
];
const colunasSolicitacao = [
  { rotulo: 'Nome', render: nome },
  { rotulo: 'CPF', chave: 'cpf' },
  { rotulo: 'Telefone', chave: 'telefone' },
  { rotulo: 'Margem livre', render: (s) => valor(s.margemLivre) },
  { rotulo: 'Status', render: (s) => STATUS_SOL.find((o) => o.valor === s.status)?.rotulo ?? s.status },
  { rotulo: 'Criada em', render: (s) => dataBR(s.criadoEm) },
];

// ---------- Simulações ----------
const camposSimulacao = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'cpf', rotulo: 'CPF', largura: 'meia' },
  { chave: 'convenio', rotulo: 'Convênio', largura: 'meia' },
  { chave: 'codEmpresa', rotulo: 'Cód. empresa', largura: 'meia' },
  { chave: 'margemLivre', rotulo: 'Margem livre (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'ddd', rotulo: 'DDD', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel', largura: 'meia' },
  { chave: 'status', rotulo: 'Status', largura: 'meia' },
  { chave: 'qtdContratosRefin', rotulo: 'Contratos p/ refin.', tipo: 'number', largura: 'meia' },
  { chave: 'contratosRefin', rotulo: 'Contratos', tipo: 'textarea' },
  { chave: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
];
const colunasSimulacao = [
  { rotulo: 'Nome', render: nome },
  { rotulo: 'CPF', chave: 'cpf' },
  { rotulo: 'Convênio', chave: 'convenio' },
  { rotulo: 'Margem livre', render: (s) => valor(s.margemLivre) },
  { rotulo: 'Status', chave: 'status' },
];

// ---------- Dívidas ----------
const camposDivida = [
  { chave: 'empregador', rotulo: 'Empregador', obrigatorio: true },
  { chave: 'dividaTotal', rotulo: 'Dívida total (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'taxaSimulacao', rotulo: 'Taxa da simulação (%)', tipo: 'number', largura: 'meia' },
  { chave: 'saldoClean', rotulo: 'Saldo clean (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'atraso', rotulo: 'Em atraso (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'cartaoCredito', rotulo: 'Cartão de crédito (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'creditoPessoal', rotulo: 'Crédito pessoal (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'creditoConsignado', rotulo: 'Crédito consignado (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'limiteEmConta', rotulo: 'Limite em conta (R$)', tipo: 'number', largura: 'meia' },
];
const colunasDivida = [
  { rotulo: 'Empregador', chave: 'empregador', render: (d) => <span className="font-medium">{d.empregador}</span> },
  { rotulo: 'Dívida total', render: (d) => valor(d.dividaTotal) },
  { rotulo: 'Em atraso', render: (d) => valor(d.atraso) },
  { rotulo: 'Consignado', render: (d) => valor(d.creditoConsignado) },
  { rotulo: 'Cartão', render: (d) => valor(d.cartaoCredito) },
];

const ABAS = [
  { valor: 'margens', rotulo: 'Margens' },
  { valor: 'solicitacoes', rotulo: 'Solicitações de margem' },
  { valor: 'simulacoes', rotulo: 'Simulações' },
  { valor: 'dividas', rotulo: 'Dívidas' },
];

export default function Credito() {
  const [aba, setAba] = useState('margens');

  return (
    <>
      <PageHeader titulo="Crédito" descricao="Margens, simulações e dívidas." />
      <Tabs abas={ABAS} ativa={aba} onChange={setAba} />

      {aba === 'margens' && (
        <CrudPage embutido titulo="Margem" endpoint="/margens" colunas={colunasMargem} campos={camposMargem} />
      )}
      {aba === 'solicitacoes' && (
        <CrudPage
          embutido
          titulo="Solicitação"
          endpoint="/solicitacoes-margem"
          padrao={{ status: 'pendente' }}
          colunas={colunasSolicitacao}
          campos={camposSolicitacao}
        />
      )}
      {aba === 'simulacoes' && (
        <CrudPage embutido titulo="Simulação" endpoint="/simulacoes" colunas={colunasSimulacao} campos={camposSimulacao} />
      )}
      {aba === 'dividas' && (
        <CrudPage embutido titulo="Dívida" endpoint="/dividas" colunas={colunasDivida} campos={camposDivida} />
      )}
    </>
  );
}
