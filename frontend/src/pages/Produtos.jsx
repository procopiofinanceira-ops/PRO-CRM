import CrudPage from '../components/CrudPage.jsx';

const campos = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true },
  { chave: 'origem', rotulo: 'Origem', largura: 'meia' },
  { chave: 'ddd', rotulo: 'DDD', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel', largura: 'meia' },
  { chave: 'qtdOutrosProdutos', rotulo: 'Qtd. de outros produtos', tipo: 'number', largura: 'meia' },
  { chave: 'outrosProdutos', rotulo: 'Outros produtos', tipo: 'textarea' },
];

const colunas = [
  { rotulo: 'Nome', chave: 'nome', render: (p) => <span className="font-medium">{p.nome}</span> },
  { rotulo: 'Origem', chave: 'origem' },
  { rotulo: 'DDD', chave: 'ddd' },
  { rotulo: 'Telefone', chave: 'telefone' },
  { rotulo: 'Outros produtos', chave: 'qtdOutrosProdutos' },
];

export default function Produtos() {
  return (
    <CrudPage
      titulo="Produtos"
      descricao="Produtos e clientes por origem."
      endpoint="/produtos"
      colunas={colunas}
      campos={campos}
      vazio="Nenhum produto cadastrado."
    />
  );
}
