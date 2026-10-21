import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCrud } from '../lib/useCrud.js';
import { dataBR, paraInputData } from '../lib/format.js';
import FormModal, { paraPayload } from '../components/FormModal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando , EstadoVazio } from '../components/Estados.jsx';

const STATUS = {
  EM_ANDAMENTO: { rotulo: 'Em andamento', cor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  CONCLUIDO: { rotulo: 'Concluído', cor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  PAUSADO: { rotulo: 'Pausado', cor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  CANCELADO: { rotulo: 'Cancelado', cor: 'bg-primary/15 text-primary' },
};

const opcoes = (obj) => Object.entries(obj).map(([valor, v]) => ({ valor, rotulo: v.rotulo ?? v }));

const campos = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true },
  { chave: 'status', rotulo: 'Status', tipo: 'select', obrigatorio: true, largura: 'meia', opcoes: opcoes(STATUS) },
  { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'select', obrigatorio: true, largura: 'meia',
    opcoes: opcoes({ BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', URGENTE: 'Urgente' }) },
  { chave: 'responsavel', rotulo: 'Responsável', largura: 'meia' },
  { chave: 'categoria', rotulo: 'Categoria', largura: 'meia' },
  { chave: 'dataInicio', rotulo: 'Início', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'dataFim', rotulo: 'Fim', tipo: 'date', largura: 'meia', paraInput: paraInputData },
  { chave: 'equipe', rotulo: 'Equipe' },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
];

function Tarefas({ projeto }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const base = `/projetos/${projeto.id}/tarefas`;
  const atualizar = () => qc.invalidateQueries({ queryKey: ['/projetos'] });

  const criar = useMutation({
    mutationFn: (t) => api(base, { method: 'POST', body: { titulo: t } }),
    onSuccess: () => {
      setTitulo('');
      atualizar();
    },
  });
  const alternar = useMutation({
    mutationFn: (t) =>
      api(`${base}/${t.id}`, { method: 'PUT', body: { status: t.status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA' } }),
    onSuccess: atualizar,
  });
  const remover = useMutation({
    mutationFn: (id) => api(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: atualizar,
  });

  return (
    <div className="mt-4 border-t border-line pt-4">
      <ul className="space-y-1">
        {projeto.tarefas.map((t) => (
          <li key={t.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface2">
            <input
              type="checkbox"
              checked={t.status === 'CONCLUIDA'}
              onChange={() => alternar.mutate(t)}
              className="h-4 w-4 accent-[rgb(var(--primary))]"
            />
            <span className={`flex-1 text-sm ${t.status === 'CONCLUIDA' ? 'text-muted line-through' : ''}`}>
              {t.titulo}
            </span>
            <button
              className="text-muted opacity-0 transition hover:text-primary group-hover:opacity-100"
              onClick={() => remover.mutate(t.id)}
              aria-label="Remover tarefa"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (titulo.trim()) criar.mutate(titulo.trim());
        }}
      >
        <input className="input" placeholder="Nova tarefa…" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <button className="btn-outline" aria-label="Adicionar tarefa">
          <Plus size={16} />
        </button>
      </form>
    </div>
  );
}

export default function Projetos() {
  const { lista, salvar, excluir } = useCrud('/projetos');
  const [editando, setEditando] = useState(null);
  const [abertos, setAbertos] = useState({});
  const itens = lista.data ?? [];

  const valoresIniciais = (p) =>
    Object.fromEntries(
      campos.map((c) => [
        c.chave,
        c.paraInput ? c.paraInput(p[c.chave]) : p[c.chave] ?? (c.chave === 'status' ? 'EM_ANDAMENTO' : c.chave === 'prioridade' ? 'MEDIA' : ''),
      ]),
    );

  return (
    <>
      <PageHeader titulo="Projetos" descricao="Acompanhe projetos e suas tarefas.">
        <button className="btn-primary" onClick={() => setEditando({})}>
          <Plus size={16} /> Novo projeto
        </button>
      </PageHeader>

      {lista.isLoading && <Carregando />}
      {lista.data?.length === 0 && <div className="card"><EstadoVazio texto="Nenhum projeto ainda." /></div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {itens.map((p) => {
          const st = STATUS[p.status];
          const aberto = abertos[p.id];
          return (
            <article key={p.id} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left" onClick={() => setEditando(p)}>
                  <h3 className="font-semibold hover:text-primary">{p.nome}</h3>
                  {p.responsavel && <p className="text-xs text-muted">{p.responsavel}</p>}
                </button>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${st.cor}`}>{st.rotulo}</span>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>Progresso</span>
                  <span>{p.progresso}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.progresso}%` }} />
                </div>
              </div>

              {(p.dataInicio || p.dataFim) && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                  <CalendarDays size={14} /> {dataBR(p.dataInicio)} → {dataBR(p.dataFim)}
                </p>
              )}

              <button
                className="mt-3 flex items-center gap-1 text-xs font-medium text-muted hover:text-fg"
                onClick={() => setAbertos((a) => ({ ...a, [p.id]: !a[p.id] }))}
              >
                <ChevronDown size={14} className={`transition ${aberto ? 'rotate-180' : ''}`} />
                {p.tarefas.length} tarefa(s)
              </button>
              {aberto && <Tarefas projeto={p} />}
            </article>
          );
        })}
      </div>

      {editando && (
        <FormModal
          titulo={editando.id ? 'Editar projeto' : 'Novo projeto'}
          campos={campos}
          valores={valoresIniciais(editando)}
          onClose={() => setEditando(null)}
          onSubmit={(form) => salvar.mutateAsync({ id: editando.id, ...paraPayload(campos, form) })}
          onExcluir={editando.id ? () => excluir.mutateAsync(editando.id) : undefined}
        />
      )}
    </>
  );
}
