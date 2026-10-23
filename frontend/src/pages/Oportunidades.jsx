import { useMemo, useState } from 'react';
import { Bell, Building2, Plus, Search, Star } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useCrud } from '../lib/useCrud.js';
import { dataBR, moeda } from '../lib/format.js';
import { ESTAGIOS, retornoVencido } from '../lib/oportunidade.js';
import { useEquipe } from '../lib/useEquipe.js';
import OportunidadeModal from '../components/crm/OportunidadeModal.jsx';
import { Carregando, EstadoVazio } from '../components/Estados.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';

// Reexportado: o painel usa os estágios para colorir o funil
export { ESTAGIOS };

const iniciais = (nome) =>
  nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export default function Oportunidades() {
  const { usuario } = useAuth();
  const podeAtribuir = ['MASTER', 'SUPERVISOR'].includes(usuario.perfil);
  const toast = useToast();
  const { nomePorId } = useEquipe(podeAtribuir);

  const [q, setQ] = useState('');
  const { lista, salvar, excluir } = useCrud('/oportunidades', { q });
  // editando: { op?: oportunidade | null, estagio?: string, aviso?: string }
  const [editando, setEditando] = useState(null);
  const [sobre, setSobre] = useState(null);

  const itens = lista.data ?? [];
  const retornos = useMemo(() => itens.filter(retornoVencido).length, [itens]);

  // Arrasta o cartão. Se o servidor exigir algo (receita esperada, motivo da perda),
  // abre o cliente já no estágio pedido para completar os dados.
  const mover = (id, estagio) => {
    const atual = itens.find((o) => o.id === id);
    if (!atual || atual.estagio === estagio) return;
    salvar.mutate(
      { id, estagio },
      {
        onError: (e) => {
          const exigeDados = /receita esperada|motivo da perda/i.test(e.message);
          if (exigeDados) setEditando({ op: atual, estagio, aviso: `Para mover para este estágio: ${e.message}` });
          else toast.erro(e.message);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        titulo="Oportunidades"
        descricao={retornos > 0 ? `${retornos} retorno${retornos > 1 ? 's' : ''} agendado${retornos > 1 ? 's' : ''} para hoje ou atrasado${retornos > 1 ? 's' : ''}.` : 'Arraste os cartões entre os estágios do funil.'}
      >
        <div className="relative hidden w-60 sm:block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
          <input className="input pl-9" placeholder="Buscar cliente, CPF…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => setEditando({ op: null })}>
          <Plus size={16} /> Nova oportunidade
        </button>
      </PageHeader>

      {lista.isError && <p className="mb-3 text-sm text-primary">{lista.error.message}</p>}
      {lista.isLoading && <Carregando />}
      {!lista.isLoading && itens.length === 0 && !q && (
        <div className="card mb-5">
          <EstadoVazio texto="Nenhuma oportunidade ainda" dica="Cadastre um cliente para começar o funil." />
        </div>
      )}

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
        {ESTAGIOS.map((e) => {
          const coluna = itens.filter((o) => o.estagio === e.valor);
          const total = coluna.reduce((s, o) => s + Number(o.valor ?? 0), 0);
          return (
            <section
              key={e.valor}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-surface2/40 p-3 backdrop-blur transition ${
                sobre === e.valor ? 'border-accent bg-accent/5 shadow-glow-accent' : 'border-line'
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
                  <span className="num rounded-full bg-surface px-2 text-xs text-muted">{coluna.length}</span>
                </div>
                <span className="num text-xs text-muted">{moeda(total)}</span>
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
                    onClick={() => setEditando({ op: o })}
                    className={`card card-hover cursor-grab p-3 active:cursor-grabbing ${retornoVencido(o) ? '!border-amber-500/60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{o.nome}</p>
                      {retornoVencido(o) && (
                        <span title={`Retorno em ${dataBR(o.dataRetorno)}${o.horaRetorno ? ` às ${o.horaRetorno}` : ''}`} className="shrink-0 text-amber-500">
                          <Bell size={14} className="animate-pulse" />
                        </span>
                      )}
                    </div>
                    {(o.empresa || o.contato?.nome) && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                        {o.empresa && <Building2 size={11} className="shrink-0" />}
                        {o.empresa ?? o.contato?.nome}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="num font-semibold">{o.valor != null ? moeda(o.valor) : '—'}</span>
                      <span className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: o.prioridade }).map((_, i) => (
                          <Star key={i} size={12} className="fill-amber-400" />
                        ))}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
                      <span>{o.dataPrevista ? `Previsto: ${dataBR(o.dataPrevista)}` : ''}</span>
                      {podeAtribuir && o.responsavelId && nomePorId[o.responsavelId] && (
                        <span className="inline-flex items-center gap-1" title={nomePorId[o.responsavelId]}>
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-accent2/40 text-[9px] font-bold text-fg">
                            {iniciais(nomePorId[o.responsavelId])}
                          </span>
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {editando && (
        <OportunidadeModal
          key={editando.op?.id ?? 'novo'}
          oportunidade={editando.op}
          estagioPadrao={editando.estagio}
          aviso={editando.aviso}
          podeAtribuir={podeAtribuir}
          onClose={() => setEditando(null)}
          onSalvar={(payload) => salvar.mutateAsync({ id: editando.op?.id, ...payload })}
          onExcluir={editando.op?.id ? () => excluir.mutateAsync(editando.op.id) : undefined}
        />
      )}
    </>
  );
}
