import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCrud } from '../lib/useCrud.js';
import FormModal, { paraPayload } from '../components/FormModal.jsx';
import PageHeader from '../components/PageHeader.jsx';

const COLUNAS = [
  { valor: 'NOVA', rotulo: 'Novas' },
  { valor: 'ANOTACAO', rotulo: 'Anotações' },
  { valor: 'ATA_REUNIAO', rotulo: 'Atas de reunião' },
  { valor: 'A_FAZER', rotulo: 'A fazer' },
];

const campos = [
  { chave: 'titulo', rotulo: 'Título', obrigatorio: true },
  { chave: 'estagio', rotulo: 'Tipo', tipo: 'select', obrigatorio: true,
    opcoes: COLUNAS.map((c) => ({ valor: c.valor, rotulo: c.rotulo })) },
  { chave: 'conteudo', rotulo: 'Conteúdo', tipo: 'textarea' },
];

export default function Observacoes() {
  const { lista, salvar, excluir } = useCrud('/observacoes');
  const [editando, setEditando] = useState(null);
  const itens = lista.data ?? [];

  return (
    <>
      <PageHeader titulo="Observações" descricao="Anotações, atas e lembretes da equipe.">
        <button className="btn-primary" onClick={() => setEditando({})}>
          <Plus size={16} /> Nova nota
        </button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUNAS.map((col) => {
          const notas = itens.filter((n) => n.estagio === col.valor);
          return (
            <section key={col.valor} className="rounded-2xl border border-line bg-surface2/50 p-3">
              <h3 className="mb-3 px-1 text-sm font-semibold">
                {col.rotulo} <span className="ml-1 text-xs font-normal text-muted">{notas.length}</span>
              </h3>
              <div className="flex flex-col gap-2">
                {notas.map((n) => (
                  <article
                    key={n.id}
                    onClick={() => setEditando(n)}
                    className="card card-hover cursor-pointer p-3"
                  >
                    <p className="text-sm font-medium">{n.titulo}</p>
                    {n.conteudo && <p className="mt-1 line-clamp-3 text-xs text-muted">{n.conteudo}</p>}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {editando && (
        <FormModal
          titulo={editando.id ? 'Editar nota' : 'Nova nota'}
          campos={campos}
          valores={{
            titulo: editando.titulo ?? '',
            estagio: editando.estagio ?? 'ANOTACAO',
            conteudo: editando.conteudo ?? '',
          }}
          onClose={() => setEditando(null)}
          onSubmit={(form) => salvar.mutateAsync({ id: editando.id, ...paraPayload(campos, form) })}
          onExcluir={editando.id ? () => excluir.mutateAsync(editando.id) : undefined}
        />
      )}
    </>
  );
}
