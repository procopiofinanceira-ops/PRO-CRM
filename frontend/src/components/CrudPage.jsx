import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useCrud } from '../lib/useCrud.js';
import FormModal, { paraPayload } from './FormModal.jsx';
import PageHeader from './PageHeader.jsx';
import { EstadoVazio, LinhasSkeleton } from './Estados.jsx';

/**
 * Página de listagem + cadastro dirigida por configuração.
 * colunas: [{ rotulo, chave, render?(item) }]
 */
export default function CrudPage({
  titulo,
  descricao,
  endpoint,
  colunas,
  campos,
  params = {},
  padrao = {},
  vazio = 'Nada por aqui ainda.',
  embutido = false,
}) {
  const [q, setQ] = useState('');
  const [editando, setEditando] = useState(null); // null | {} (novo) | item
  const { lista, salvar, excluir } = useCrud(endpoint, { q, ...params });

  const abrirNovo = () => setEditando({ ...padrao });
  const valoresIniciais = (item) =>
    Object.fromEntries(campos.map((c) => [c.chave, c.paraInput ? c.paraInput(item[c.chave]) : item[c.chave] ?? '']));

  return (
    <>
      {!embutido && (
        <PageHeader titulo={titulo} descricao={descricao}>
          <button className="btn-primary" onClick={abrirNovo}>
            <Plus size={16} /> Novo
          </button>
        </PageHeader>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {embutido && (
          <button className="btn-primary" onClick={abrirNovo}>
            <Plus size={16} /> Novo
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
              <tr>
                {colunas.map((c) => (
                  <th key={c.rotulo} className="whitespace-nowrap px-4 py-3 font-medium">
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="stagger divide-y divide-line">
              {lista.data?.map((item, i) => (
                <tr
                  key={item.id}
                  style={{ '--i': Math.min(i, 12) }}
                  className="cursor-pointer transition hover:bg-surface2/60"
                  onClick={() => setEditando(item)}
                >
                  {colunas.map((c) => (
                    <td key={c.rotulo} className="whitespace-nowrap px-4 py-3">
                      {c.render ? c.render(item) : item[c.chave] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.isLoading && <LinhasSkeleton colunas={colunas.length} />}
        {lista.isError && <p className="p-6 text-center text-sm text-primary">{lista.error.message}</p>}
        {lista.data?.length === 0 && <EstadoVazio texto={vazio} dica={q ? 'Tente outro termo de busca.' : 'Use o botão Novo para começar.'} />}
      </div>

      {editando && (
        <FormModal
          titulo={editando.id ? `Editar ${titulo.toLowerCase()}` : `Novo registro`}
          campos={campos}
          valores={valoresIniciais(editando)}
          onClose={() => setEditando(null)}
          onSubmit={(form) => salvar.mutateAsync({ id: editando.id, ...padrao, ...paraPayload(campos, form) })}
          onExcluir={editando.id ? () => excluir.mutateAsync(editando.id) : undefined}
        />
      )}
    </>
  );
}
