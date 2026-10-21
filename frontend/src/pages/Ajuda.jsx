import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import CrudPage from '../components/CrudPage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import { api } from '../lib/api.js';
import { dataBR } from '../lib/format.js';

const STATUS = [
  { valor: 'NOVO', rotulo: 'Novo', cor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  { valor: 'EM_ANDAMENTO', rotulo: 'Em andamento', cor: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  { valor: 'AGUARDANDO', rotulo: 'Aguardando', cor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { valor: 'RESOLVIDO', rotulo: 'Resolvido', cor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { valor: 'FECHADO', rotulo: 'Fechado', cor: 'bg-slate-400/20 text-slate-600 dark:text-slate-300' },
];
const PRIORIDADES = [
  { valor: 'BAIXA', rotulo: 'Baixa' },
  { valor: 'MEDIA', rotulo: 'Média' },
  { valor: 'ALTA', rotulo: 'Alta' },
  { valor: 'URGENTE', rotulo: 'Urgente' },
];

export default function Ajuda() {
  const [aba, setAba] = useState('chamados');
  const { data: times = [] } = useQuery({
    queryKey: ['/times-ajuda', {}],
    queryFn: () => api('/times-ajuda'),
    select: (r) => r.itens,
  });

  const camposChamado = [
    { chave: 'titulo', rotulo: 'Título', obrigatorio: true },
    { chave: 'status', rotulo: 'Status', tipo: 'select', obrigatorio: true, largura: 'meia',
      opcoes: STATUS.map((s) => ({ valor: s.valor, rotulo: s.rotulo })) },
    { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'select', obrigatorio: true, largura: 'meia', opcoes: PRIORIDADES },
    { chave: 'timeId', rotulo: 'Time responsável', tipo: 'select', largura: 'meia',
      opcoes: times.map((t) => ({ valor: t.id, rotulo: t.nome })) },
    { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
  ];

  const colunasChamado = [
    { rotulo: 'Título', render: (c) => <span className="font-medium">{c.titulo}</span> },
    {
      rotulo: 'Status',
      render: (c) => {
        const s = STATUS.find((x) => x.valor === c.status);
        return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s?.cor}`}>{s?.rotulo}</span>;
      },
    },
    { rotulo: 'Prioridade', render: (c) => PRIORIDADES.find((p) => p.valor === c.prioridade)?.rotulo },
    { rotulo: 'Time', render: (c) => c.time?.nome ?? '—' },
    { rotulo: 'Aberto em', render: (c) => dataBR(c.criadoEm) },
  ];

  const camposTime = [
    { chave: 'nome', rotulo: 'Nome do time', obrigatorio: true },
    { chave: 'naoAtribuidos', rotulo: 'Não atribuídos', tipo: 'number', largura: 'meia' },
    { chave: 'naoAtendidos', rotulo: 'Não atendidos', tipo: 'number', largura: 'meia' },
    { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'number', largura: 'meia' },
  ];
  const colunasTime = [
    { rotulo: 'Time', render: (t) => <span className="font-medium">{t.nome}</span> },
    { rotulo: 'Não atribuídos', chave: 'naoAtribuidos' },
    { rotulo: 'Não atendidos', chave: 'naoAtendidos' },
  ];

  return (
    <>
      <PageHeader titulo="Central de ajuda" descricao="Abra chamados e acompanhe o atendimento." />
      <Tabs
        abas={[{ valor: 'chamados', rotulo: 'Chamados' }, { valor: 'times', rotulo: 'Times' }]}
        ativa={aba}
        onChange={setAba}
      />
      {aba === 'chamados' ? (
        <CrudPage
          embutido
          titulo="Chamado"
          endpoint="/chamados"
          padrao={{ status: 'NOVO', prioridade: 'MEDIA' }}
          colunas={colunasChamado}
          campos={camposChamado}
          vazio="Nenhum chamado aberto."
        />
      ) : (
        <CrudPage
          embutido
          titulo="Time"
          endpoint="/times-ajuda"
          colunas={colunasTime}
          campos={camposTime}
          vazio="Nenhum time cadastrado."
        />
      )}
    </>
  );
}
