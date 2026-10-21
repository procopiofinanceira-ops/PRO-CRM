import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useCrud } from '../lib/useCrud.js';
import { paraInputDataHora } from '../lib/format.js';
import FormModal, { paraPayload } from '../components/FormModal.jsx';
import PageHeader from '../components/PageHeader.jsx';

const CORES = {
  indigo: 'bg-indigo-500',
  red: 'bg-primary',
  green: 'bg-emerald-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

const campos = [
  { chave: 'titulo', rotulo: 'Título', obrigatorio: true },
  { chave: 'dataInicio', rotulo: 'Início', tipo: 'datetime', obrigatorio: true, largura: 'meia', paraInput: paraInputDataHora },
  { chave: 'dataFim', rotulo: 'Fim', tipo: 'datetime', obrigatorio: true, largura: 'meia', paraInput: paraInputDataHora },
  { chave: 'local', rotulo: 'Local', largura: 'meia' },
  { chave: 'participante', rotulo: 'Participante', largura: 'meia' },
  { chave: 'cor', rotulo: 'Cor', tipo: 'select', obrigatorio: true, largura: 'meia',
    opcoes: [
      { valor: 'red', rotulo: 'Vermelho' }, { valor: 'indigo', rotulo: 'Índigo' }, { valor: 'green', rotulo: 'Verde' },
      { valor: 'orange', rotulo: 'Laranja' }, { valor: 'pink', rotulo: 'Rosa' }, { valor: 'cyan', rotulo: 'Ciano' },
    ] },
  { chave: 'diaInteiro', rotulo: 'Dia inteiro', tipo: 'checkbox', largura: 'meia' },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
];

const chaveDia = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function Calendario() {
  const [ref, setRef] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const { lista, salvar, excluir } = useCrud('/eventos');
  const [editando, setEditando] = useState(null);

  const dias = useMemo(() => {
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1 - ref.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  }, [ref]);

  const porDia = useMemo(() => {
    const mapa = {};
    for (const ev of lista.data ?? []) {
      const d = new Date(ev.dataInicio);
      (mapa[chaveDia(d)] ??= []).push(ev);
    }
    return mapa;
  }, [lista.data]);

  const hoje = chaveDia(new Date());
  const mes = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const novoNoDia = (dia) => {
    const ini = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 9, 0);
    const fim = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 10, 0);
    setEditando({ dataInicio: ini.toISOString(), dataFim: fim.toISOString() });
  };

  const valoresIniciais = (ev) =>
    Object.fromEntries(
      campos.map((c) => [c.chave, c.paraInput ? c.paraInput(ev[c.chave]) : ev[c.chave] ?? (c.chave === 'cor' ? 'red' : c.tipo === 'checkbox' ? false : '')]),
    );

  return (
    <>
      <PageHeader titulo="Calendário" descricao="Compromissos e reuniões.">
        <button className="btn-primary" onClick={() => novoNoDia(new Date())}>
          <Plus size={16} /> Novo evento
        </button>
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold capitalize">{mes}</h2>
          <div className="flex gap-1">
            <button className="btn-ghost !p-2" aria-label="Mês anterior"
              onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}>
              <ChevronLeft size={18} />
            </button>
            <button className="btn-ghost" onClick={() => setRef(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
              Hoje
            </button>
            <button className="btn-ghost !p-2" aria-label="Próximo mês"
              onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-line bg-surface2 text-center text-xs font-medium text-muted">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const eventos = porDia[chaveDia(dia)] ?? [];
            const doMes = dia.getMonth() === ref.getMonth();
            const ehHoje = chaveDia(dia) === hoje;
            return (
              <div
                key={dia.toISOString()}
                onClick={() => novoNoDia(dia)}
                className={`min-h-[5.5rem] cursor-pointer border-b border-r border-line p-1.5 transition hover:bg-surface2/60 ${doMes ? '' : 'bg-surface2/40 text-muted'}`}
              >
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${ehHoje ? 'bg-primary font-semibold text-primary-fg' : ''}`}>
                  {dia.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {eventos.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditando(ev);
                      }}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white ${CORES[ev.cor] ?? CORES.indigo}`}
                    >
                      {ev.titulo}
                    </button>
                  ))}
                  {eventos.length > 3 && <p className="px-1 text-[11px] text-muted">+{eventos.length - 3} mais</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editando && (
        <FormModal
          titulo={editando.id ? 'Editar evento' : 'Novo evento'}
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
