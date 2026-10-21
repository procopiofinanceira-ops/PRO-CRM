import { Star } from 'lucide-react';
import CrudPage from '../components/CrudPage.jsx';

const campos = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, largura: 'meia',
    opcoes: [{ valor: 'PESSOA', rotulo: 'Pessoa' }, { valor: 'EMPRESA', rotulo: 'Empresa' }] },
  { chave: 'empresa', rotulo: 'Empresa', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel', largura: 'meia' },
  { chave: 'email', rotulo: 'E-mail', tipo: 'email', largura: 'meia' },
  { chave: 'pais', rotulo: 'País', largura: 'meia' },
  { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
  { chave: 'favorito', rotulo: 'Favorito', tipo: 'checkbox' },
];

const colunas = [
  { rotulo: '', render: (c) => <Star size={16} className={c.favorito ? 'fill-primary text-primary' : 'text-line'} /> },
  { rotulo: 'Nome', chave: 'nome', render: (c) => <span className="font-medium">{c.nome}</span> },
  { rotulo: 'Empresa', chave: 'empresa' },
  { rotulo: 'Telefone', chave: 'telefone' },
  { rotulo: 'E-mail', chave: 'email' },
  { rotulo: 'Tipo', render: (c) => (c.tipo === 'EMPRESA' ? 'Empresa' : 'Pessoa') },
];

export default function Contatos() {
  return (
    <CrudPage
      titulo="Contatos"
      descricao="Pessoas e empresas com quem você se relaciona."
      endpoint="/contatos"
      colunas={colunas}
      campos={campos}
      vazio="Nenhum contato cadastrado."
    />
  );
}
