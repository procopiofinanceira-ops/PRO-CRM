import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import CrudPage from '../components/CrudPage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import { dataBR, paraInputData } from '../lib/format.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const mascaraCnpj = (v) =>
  soDigitos(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');

const camposCompleto = [
  { chave: 'nome', rotulo: 'Nome do convênio', obrigatorio: true },
  { chave: 'cnpj', rotulo: 'CNPJ', largura: 'meia', paraInput: mascaraCnpj },
  { chave: 'codigo', rotulo: 'Código', largura: 'meia' },
];

const colunasCompleto = [
  { rotulo: 'Nome', chave: 'nome', render: (c) => <span className="font-medium">{c.nome}</span> },
  { rotulo: 'CNPJ', chave: 'cnpj' },
  { rotulo: 'Código', chave: 'codigo' },
];

const camposControle = [
  { chave: 'empregador', rotulo: 'Empregador', obrigatorio: true },
  { chave: 'codigo', rotulo: 'Código', largura: 'meia' },
  { chave: 'tipoMargem', rotulo: 'Tipo de margem', largura: 'meia' },
  { chave: 'funcionarios', rotulo: 'Funcionários', tipo: 'number', largura: 'meia' },
  { chave: 'naoReservados', rotulo: 'Não reservados', tipo: 'number', largura: 'meia' },
  { chave: 'reservados', rotulo: 'Reservados', tipo: 'number', largura: 'meia' },
  { chave: 'perdidos', rotulo: 'Perdidos', tipo: 'number', largura: 'meia' },
];

const colunasControle = [
  { rotulo: 'Empregador', chave: 'empregador', render: (c) => <span className="font-medium">{c.empregador}</span> },
  { rotulo: 'Código', chave: 'codigo' },
  { rotulo: 'Margem', chave: 'tipoMargem' },
  { rotulo: 'Funcionários', chave: 'funcionarios' },
  { rotulo: 'Não reservados', chave: 'naoReservados' },
  { rotulo: 'Reservados', chave: 'reservados' },
  { rotulo: 'Perdidos', chave: 'perdidos' },
];

const camposInconsistencia = [
  { chave: 'parceiro', rotulo: 'Parceiro', obrigatorio: true },
  { chave: 'codigoConvenio', rotulo: 'Código do convênio', obrigatorio: true, largura: 'meia' },
  { chave: 'dataRegistro', rotulo: 'Data do registro', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'resolvido', rotulo: 'Resolvido', tipo: 'checkbox' },
  { chave: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
];

const colunasInconsistencia = [
  { rotulo: 'Parceiro', chave: 'parceiro', render: (c) => <span className="font-medium">{c.parceiro}</span> },
  { rotulo: 'Convênio', chave: 'codigoConvenio' },
  { rotulo: 'Registro', render: (c) => dataBR(c.dataRegistro) },
  {
    rotulo: 'Situação',
    render: (c) =>
      c.resolvido ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check size={14} /> Resolvido
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Clock size={14} /> Pendente
        </span>
      ),
  },
];

const ABAS = [
  { valor: 'meus', rotulo: 'Meus convênios' },
  { valor: 'cadastrados', rotulo: 'Cadastrados' },
  { valor: 'duplicados', rotulo: 'Leads duplicados' },
  { valor: 'inconsistencias', rotulo: 'Inconsistências' },
];

export default function Convenios() {
  const [aba, setAba] = useState('meus');

  return (
    <>
      <PageHeader titulo="Convênios" descricao="Cadastro, controle de reservas e inconsistências." />
      <Tabs abas={ABAS} ativa={aba} onChange={setAba} />

      {aba === 'meus' && (
        <CrudPage
          embutido
          titulo="Convênio"
          endpoint="/convenios-completos"
          colunas={colunasCompleto}
          campos={camposCompleto}
          vazio="Nenhum convênio cadastrado."
        />
      )}
      {aba === 'cadastrados' && (
        <CrudPage
          embutido
          titulo="Convênio cadastrado"
          endpoint="/convenios-controle"
          params={{ tipo: 'CADASTRADO' }}
          padrao={{ tipo: 'CADASTRADO' }}
          colunas={colunasControle}
          campos={camposControle}
        />
      )}
      {aba === 'duplicados' && (
        <CrudPage
          embutido
          titulo="Lead duplicado"
          endpoint="/convenios-controle"
          params={{ tipo: 'LEAD_DUPLICADO' }}
          padrao={{ tipo: 'LEAD_DUPLICADO' }}
          colunas={colunasControle}
          campos={camposControle}
        />
      )}
      {aba === 'inconsistencias' && (
        <CrudPage
          embutido
          titulo="Inconsistência"
          endpoint="/inconsistencias"
          colunas={colunasInconsistencia}
          campos={camposInconsistencia}
          vazio="Nenhuma inconsistência registrada."
        />
      )}
    </>
  );
}
