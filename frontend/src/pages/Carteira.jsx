import CrudPage from '../components/CrudPage.jsx';

const campos = [
  { chave: 'nome', rotulo: 'Nome do cliente' },
  { chave: 'cpf', rotulo: 'CPF', obrigatorio: true, largura: 'meia' },
  { chave: 'cpfCliente', rotulo: 'CPF do cliente', largura: 'meia' },
  { chave: 'convenio', rotulo: 'Convênio', largura: 'meia' },
  { chave: 'codEmpresa', rotulo: 'Cód. empresa', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel' },
];

const colunas = [
  { rotulo: 'Nome', render: (c) => <span className="font-medium">{c.nome ?? '—'}</span> },
  { rotulo: 'CPF', chave: 'cpf' },
  { rotulo: 'CPF do cliente', chave: 'cpfCliente' },
  { rotulo: 'Convênio', chave: 'convenio' },
  { rotulo: 'Telefone', chave: 'telefone' },
];

export default function Carteira() {
  return (
    <CrudPage
      titulo="Carteira"
      descricao="Clientes acompanhados pela sua equipe."
      endpoint="/carteira"
      colunas={colunas}
      campos={campos}
      vazio="Nenhum cliente na carteira."
    />
  );
}
