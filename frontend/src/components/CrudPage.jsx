import { useState } from 'react';
import { LayoutGrid, Plus, Rows3, Search } from 'lucide-react';
import { useCrud } from '../lib/useCrud.js';
import FormModal, { paraPayload } from './FormModal.jsx';
import PageHeader from './PageHeader.jsx';
import { EstadoVazio, LinhasSkeleton } from './Estados.jsx';

const BORDA = { amarelo: 'border-l-amber-500', verde: 'border-l-emerald-500', vermelho: 'border-l-red-500' };
// Sombra ao passar o mouse, na cor da situação (vermelho da marca quando não há)
const SOMBRA = {
  amarelo: 'hover:shadow-amber-500/30',
  verde: 'hover:shadow-emerald-500/30',
  vermelho: 'hover:shadow-red-500/30',
};
const FUNDO = { amarelo: 'bg-amber-500/10', verde: 'bg-emerald-500/10', vermelho: 'bg-red-500/10' };

/**
 * Página de listagem + cadastro dirigida por configuração.
 * colunas: [{ rotulo, chave, render?(item) }]
 * filtros?: [{ chave, rotulo, soDigitos? }] troca a busca única por um campo por filtro (enviado como ?chave=valor).
 * quadrado: cards em formato quadrado, em grade mais densa.
 * tom?(item): 'amarelo' | 'verde' | 'vermelho' | null, destaca a linha/card (use com `legenda`).
 * cartao?(item): quando informado, a página oferece também a visão em cards (a escolha fica salva por página).
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
  cartao,
  filtros,
  quadrado = false,
  tom,
  legenda,
}) {
  const [campos_, setCampos_] = useState({});
  const [q, setQ] = useState('');
  const [editando, setEditando] = useState(null); // null | {} (novo) | item
  const chaveVisao = `visao:${endpoint}`;
  const [visao, setVisao] = useState(() => {
    try {
      return localStorage.getItem(chaveVisao) === 'tabela' ? 'tabela' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const emCards = Boolean(cartao) && visao === 'cards';
  const trocarVisao = (v) => {
    setVisao(v);
    try {
      localStorage.setItem(chaveVisao, v);
    } catch {
      /* sem armazenamento: só não lembra */
    }
  };
  const { lista, salvar, excluir } = useCrud(endpoint, { q, ...params, ...campos_ });

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
        {filtros ? (
          <div className="grid w-full flex-1 gap-2 sm:grid-cols-3 lg:max-w-3xl">
            {filtros.map((f) => (
              <div key={f.chave} className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-9"
                  aria-label={`Filtrar por ${f.rotulo.toLowerCase()}`}
                  placeholder={f.rotulo}
                  value={campos_[f.chave] ?? ''}
                  inputMode={f.soDigitos ? 'numeric' : undefined}
                  onChange={(e) => {
                    const v = f.soDigitos ? e.target.value.replace(/\D/g, '') : e.target.value;
                    setCampos_((atual) => ({ ...atual, [f.chave]: v }));
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative w-full max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <div className="flex items-center gap-2">
          {cartao && (
            <div className="flex rounded-lg border border-line bg-surface2 p-0.5" role="group" aria-label="Modo de exibição">
              {[
                ['cards', 'Cards', LayoutGrid],
                ['tabela', 'Tabela', Rows3],
              ].map(([v, rotulo, Icone]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={visao === v}
                  onClick={() => trocarVisao(v)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    visao === v ? 'bg-primary text-white shadow-glow' : 'text-muted hover:text-text'
                  }`}
                >
                  <Icone size={14} /> {rotulo}
                </button>
              ))}
            </div>
          )}
          {embutido && (
            <button className="btn-primary" onClick={abrirNovo}>
              <Plus size={16} /> Novo
            </button>
          )}
        </div>
      </div>

      {legenda}

      {emCards && (
        <div
          className={`stagger grid gap-3 ${
            quadrado ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'sm:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {lista.data?.map((item, i) => (
            <div
              key={item.id}
              style={{ '--i': Math.min(i, 12) }}
              role="button"
              tabIndex={0}
              className={`card glow-border cursor-pointer border-l-4 p-4 transition-[translate,scale,box-shadow] duration-300 ease-out hover:z-10 hover:shadow-xl hover:[scale:1.04] hover:[translate:0_-6px] active:[scale:0.98] ${SOMBRA[tom?.(item)] ?? 'hover:shadow-primary/30'} ${quadrado ? 'aspect-square' : ''} ${BORDA[tom?.(item)] ?? 'border-l-transparent'}`}
              onClick={() => setEditando(item)}
              onKeyDown={(e) => e.key === 'Enter' && setEditando(item)}
            >
              {cartao(item)}
            </div>
          ))}
        </div>
      )}

      <div className={emCards ? '' : 'card overflow-hidden'}>
        {!emCards && (
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
                  className={`cursor-pointer border-l-4 transition hover:bg-surface2/60 ${BORDA[tom?.(item)] ?? 'border-l-transparent'} ${FUNDO[tom?.(item)] ?? ''}`}
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
        )}
        {lista.isLoading && <LinhasSkeleton colunas={colunas.length} />}
        {lista.isError && <p className="p-6 text-center text-sm text-primary">{lista.error.message}</p>}
        {lista.data?.length === 0 && <EstadoVazio texto={vazio} dica={q || Object.values(campos_).some(Boolean) ? 'Tente outro termo de busca.' : 'Use o botão Novo para começar.'} />}
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
