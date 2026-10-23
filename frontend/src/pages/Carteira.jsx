import CrudPage from '../components/CrudPage.jsx';

const campos = [
  { chave: 'nome', rotulo: 'Nome do cliente' },
  { chave: 'cpf', rotulo: 'CPF', obrigatorio: true, largura: 'meia' },
  { chave: 'convenio', rotulo: 'Convênio', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel' },
];

const filtros = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'cpf', rotulo: 'CPF', soDigitos: true },
  { chave: 'telefone', rotulo: 'Telefone', soDigitos: true },
];

const SITUACAO = {
  negociacao: { tom: 'amarelo', rotulo: 'Em negociação', classe: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', ponto: 'bg-amber-500' },
  ganhamos: { tom: 'verde', rotulo: 'Ganhamos', classe: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', ponto: 'bg-emerald-500' },
  perdemos: { tom: 'vermelho', rotulo: 'Perdido', classe: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30', ponto: 'bg-red-500' },
};

const Selo = ({ situacao }) =>
  SITUACAO[situacao] ? (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SITUACAO[situacao].classe}`}>{SITUACAO[situacao].rotulo}</span>
  ) : (
    <span className="text-xs text-muted">Sem oportunidade</span>
  );

const legenda = (
  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
    {Object.values(SITUACAO).map((s) => (
      <span key={s.rotulo} className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${s.ponto}`} /> {s.rotulo}
      </span>
    ))}
    <span>· ligado às Oportunidades pelo CPF</span>
  </div>
);

const colunas = [
  { rotulo: 'Nome', render: (c) => <span className="font-medium">{c.nome ?? '—'}</span> },
  { rotulo: 'CPF', chave: 'cpf' },
  { rotulo: 'Convênio', chave: 'convenio' },
  { rotulo: 'Telefone', chave: 'telefone' },
  { rotulo: 'Situação', render: (c) => <Selo situacao={c.situacao} /> },
];

const Linha = ({ rotulo, valor }) => (
  <div className="flex justify-between gap-3 text-xs">
    <span className="text-muted">{rotulo}</span>
    <span className="num truncate">{valor || '—'}</span>
  </div>
);

const cartao = (c) => (
  <div className="flex h-full flex-col">
    <div className="flex items-start justify-between gap-2">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-semibold text-primary">
        {(c.nome ?? '?').trim().charAt(0).toUpperCase()}
      </div>
      <Selo situacao={c.situacao} />
    </div>
    <div className="mt-3 min-w-0">
      <p className="truncate font-medium">{c.nome ?? 'Sem nome'}</p>
      <p className="kicker truncate">{c.convenio ?? 'Sem convênio'}</p>
    </div>
    <div className="mt-auto space-y-1.5 border-t border-line pt-3">
      <Linha rotulo="CPF" valor={c.cpf} />
      <Linha rotulo="Telefone" valor={c.telefone} />
    </div>
  </div>
);

export default function Carteira() {
  return (
    <CrudPage
      titulo="Carteira"
      descricao="Clientes acompanhados pela sua equipe."
      endpoint="/carteira"
      colunas={colunas}
      campos={campos}
      cartao={cartao}
      quadrado
      filtros={filtros}
      tom={(c) => SITUACAO[c.situacao]?.tom}
      legenda={legenda}
      vazio="Nenhum cliente na carteira."
    />
  );
}
