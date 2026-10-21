import { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { useCrud } from '../lib/useCrud.js';
import { dataBR, moeda, paraInputData } from '../lib/format.js';
import FormModal, { paraPayload } from '../components/FormModal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando } from '../components/Estados.jsx';
import { useToast } from '../components/Toast.jsx';

export const ESTAGIOS = [
  { valor: 'novo', rotulo: 'Novo', cor: 'bg-slate-400' },
  { valor: 'contactando', rotulo: 'Contactando', cor: 'bg-sky-500' },
  { valor: 'segundo_dia', rotulo: '2º dia', cor: 'bg-amber-500' },
  { valor: 'terceiro_dia', rotulo: '3º dia', cor: 'bg-orange-500' },
  { valor: 'proposta', rotulo: 'Proposta', cor: 'bg-violet-500' },
  { valor: 'ganhamos', rotulo: 'Ganhamos', cor: 'bg-emerald-500' },
  { valor: 'perdemos', rotulo: 'Perdemos', cor: 'bg-primary' },
];

const campos = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true },
  { chave: 'estagio', rotulo: 'Estágio', tipo: 'select', obrigatorio: true, largura: 'meia',
    opcoes: ESTAGIOS.map((e) => ({ valor: e.valor, rotulo: e.rotulo })) },
  { chave: 'valor', rotulo: 'Valor (R$)', tipo: 'number', largura: 'meia' },
  { chave: 'empresa', rotulo: 'Empresa', largura: 'meia' },
  { chave: 'produto', rotulo: 'Produto', largura: 'meia' },
  { chave: 'telefone', rotulo: 'Telefone', tipo: 'tel', largura: 'meia' },
  { chave: 'email', rotulo: 'E-mail', tipo: 'email', largura: 'meia' },
  { chave: 'cpf', rotulo: 'CPF', largura: 'meia' },
  { chave: 'cidade', rotulo: 'Cidade', largura: 'meia' },
  { chave: 'dataPrevista', rotulo: 'Data prevista', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'select', obrigatorio: true, largura: 'meia',
    opcoes: [0, 1, 2, 3].map((n) => ({ valor: String(n), rotulo: n ? '★'.repeat(n) : 'Sem prioridade' })) },
  { chave: 'motivoPerda', rotulo: 'Motivo da perda' },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
];

export default function Oportunidades() {
  const { lista, salvar, excluir } = useCrud('/oportunidades');
  const toast = useToast();
  const [editando, setEditando] = useState(null);
  const [sobre, setSobre] = useState(null);

  const itens = lista.data ?? [];

  const mover = (id, estagio) => {
    const atual = itens.find((o) => o.id === id);
    if (!atual || atual.estagio === estagio) return;
    const dados = { id, estagio };
    if (estagio === 'perdemos') {
      const motivo = window.prompt('Motivo da perda (opcional):');
      if (motivo === null) return;
      if (motivo) dados.motivoPerda = motivo;
    }
    salvar.mutate(dados, { onError: (e) => toast.erro(e.message) });
  };

  const valoresIniciais = (o) =>
    Object.fromEntries(
      campos.map((c) => [
        c.chave,
        c.paraInput ? c.paraInput(o[c.chave]) : c.chave === 'prioridade' ? String(o.prioridade ?? 0) : o[c.chave] ?? (c.chave === 'estagio' ? 'novo' : ''),
      ]),
    );

  return (
    <>
      <PageHeader titulo="Oportunidades" descricao="Arraste os cartões entre os estágios do funil.">
        <button className="btn-primary" onClick={() => setEditando({})}>
          <Plus size={16} /> Nova oportunidade
        </button>
      </PageHeader>

      {lista.isError && <p className="mb-3 text-sm text-primary">{lista.error.message}</p>}

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
        {ESTAGIOS.map((e) => {
          const coluna = itens.filter((o) => o.estagio === e.valor);
          const total = coluna.reduce((s, o) => s + Number(o.valor ?? 0), 0);
          return (
            <section
              key={e.valor}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-surface2/50 p-3 transition ${
                sobre === e.valor ? 'border-primary bg-primary/5' : 'border-line'
              }`}
              onDragOver={(ev) => {
                ev.preventDefault();
                setSobre(e.valor);
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(ev) => {
                ev.preventDefault();
                setSobre(null);
                mover(ev.dataTransfer.getData('text/plain'), e.valor);
              }}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${e.cor}`} />
                  <h3 className="text-sm font-semibold">{e.rotulo}</h3>
                  <span className="rounded-full bg-surface px-2 text-xs text-muted">{coluna.length}</span>
                </div>
                <span className="text-xs text-muted">{moeda(total)}</span>
              </header>

              <div className="flex min-h-[4rem] flex-col gap-2">
                {coluna.map((o) => (
                  <article
                    key={o.id}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData('text/plain', o.id);
                      ev.currentTarget.classList.add('opacity-50', 'rotate-1', 'scale-95');
                    }}
                    onDragEnd={(ev) => ev.currentTarget.classList.remove('opacity-50', 'rotate-1', 'scale-95')}
                    onClick={() => setEditando(o)}
                    className="card card-hover cursor-grab p-3 active:cursor-grabbing"
                  >
                    <p className="text-sm font-medium">{o.nome}</p>
                    {(o.contato?.nome || o.empresa) && (
                      <p className="mt-0.5 text-xs text-muted">{o.contato?.nome ?? o.empresa}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold">{o.valor != null ? moeda(o.valor) : '—'}</span>
                      <span className="flex items-center gap-0.5 text-primary">
                        {Array.from({ length: o.prioridade }).map((_, i) => (
                          <Star key={i} size={12} className="fill-primary" />
                        ))}
                      </span>
                    </div>
                    {o.dataPrevista && <p className="mt-1 text-xs text-muted">Previsto: {dataBR(o.dataPrevista)}</p>}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {lista.isLoading && <Carregando />}

      {editando && (
        <FormModal
          titulo={editando.id ? 'Editar oportunidade' : 'Nova oportunidade'}
          campos={campos}
          valores={valoresIniciais(editando)}
          onClose={() => setEditando(null)}
          onSubmit={(form) => {
            const dados = paraPayload(campos, form);
            dados.prioridade = Number(form.prioridade || 0);
            return salvar.mutateAsync({ id: editando.id, ...dados });
          }}
          onExcluir={editando.id ? () => excluir.mutateAsync(editando.id) : undefined}
        />
      )}
    </>
  );
}
