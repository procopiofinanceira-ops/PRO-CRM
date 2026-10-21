import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Share2, Trash2, UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import DistribuirModal from '../components/DistribuirModal.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando , EstadoVazio } from '../components/Estados.jsx';

function NovaCampanha({ onClose }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [marcados, setMarcados] = useState([]);
  const [erro, setErro] = useState('');

  const { data: convenios = [], isLoading } = useQuery({
    queryKey: ['/leads/convenios'],
    queryFn: () => api('/leads/convenios'),
    select: (r) => r.itens,
  });

  const criar = useMutation({
    mutationFn: () => api('/campanhas', { method: 'POST', body: { nome, convenios: marcados } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/campanhas'] });
      onClose();
    },
    onError: (e) => setErro(e.message),
  });

  const alternar = (c) => setMarcados((m) => (m.includes(c) ? m.filter((x) => x !== c) : [...m, c]));

  return (
    <Modal titulo="Nova campanha" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="nome">Nome da campanha</label>
          <input id="nome" className="input" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div>
          <span className="label">Convênios da campanha</span>
          {isLoading && <Carregando />}
          {!isLoading && convenios.length === 0 && (
            <p className="rounded-xl bg-surface2 p-3 text-sm text-muted">
              Ainda não há convênios na base. Importe uma planilha primeiro.
            </p>
          )}
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {convenios.map((c) => (
              <li key={c.convenio}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface2">
                  <input
                    type="checkbox"
                    checked={marcados.includes(c.convenio)}
                    onChange={() => alternar(c.convenio)}
                    className="h-4 w-4 accent-[rgb(var(--primary))]"
                  />
                  <span className="flex-1 text-sm">{c.convenio}</span>
                  <span className="text-xs text-muted">{c.semResponsavel.toLocaleString('pt-BR')} livres</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{erro}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary"
            disabled={nome.trim().length < 2 || !marcados.length || criar.isPending}
            onClick={() => criar.mutate()}
          >
            {criar.isPending && <Loader2 size={16} className="animate-spin" />} Criar campanha
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Campanhas() {
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [distribuindo, setDistribuindo] = useState(null);
  const [aviso, setAviso] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['/campanhas'],
    queryFn: () => api('/campanhas'),
    select: (r) => r.itens,
  });

  const atualizar = () => qc.invalidateQueries({ queryKey: ['/campanhas'] });

  const adicionar = useMutation({
    mutationFn: (id) => api(`/campanhas/${id}/adicionar`, { method: 'POST', body: {} }),
    onSuccess: (r) => {
      setAviso(
        r.adicionados
          ? `${r.adicionados.toLocaleString('pt-BR')} leads adicionados à campanha.`
          : 'Nenhum lead novo para adicionar (todos já estão na campanha ou têm responsável).',
      );
      atualizar();
    },
    onError: (e) => setAviso(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id) => api(`/campanhas/${id}`, { method: 'DELETE' }),
    onSuccess: atualizar,
  });

  return (
    <>
      <PageHeader titulo="Campanhas" descricao="Agrupe leads por convênio e distribua para a equipe.">
        <button className="btn-primary" onClick={() => setCriando(true)}>
          <Plus size={16} /> Nova campanha
        </button>
      </PageHeader>

      {aviso && (
        <p className="mb-4 flex items-center justify-between rounded-xl bg-surface2 px-4 py-3 text-sm">
          {aviso}
          <button className="text-muted hover:text-fg" onClick={() => setAviso('')} aria-label="Fechar aviso">×</button>
        </p>
      )}

      {isLoading && <Carregando />}
      {error && <p className="text-sm text-primary">{error.message}</p>}
      {data?.length === 0 && <div className="card"><EstadoVazio texto="Nenhuma campanha criada." /></div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((c) => (
          <article key={c.id} className="card card-hover flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{c.nome}</h3>
              <button
                className="text-muted hover:text-primary"
                aria-label="Excluir campanha"
                onClick={() => {
                  if (window.confirm(`Excluir a campanha "${c.nome}"? Os leads continuam na base.`)) excluir.mutate(c.id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.convenios.map((v) => (
                <span key={v} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{v}</span>
              ))}
            </div>

            <p className="mt-4 text-2xl font-semibold tracking-tight">
              {c._count.clientes.toLocaleString('pt-BR')}
              <span className="ml-1.5 text-sm font-normal text-muted">leads na campanha</span>
            </p>

            <div className="mt-4 flex gap-2">
              <button
                className="btn-outline flex-1"
                disabled={adicionar.isPending}
                onClick={() => adicionar.mutate(c.id)}
              >
                <UserPlus size={16} /> Puxar leads
              </button>
              <button
                className="btn-primary flex-1"
                disabled={c._count.clientes === 0}
                onClick={() => setDistribuindo(c)}
              >
                <Share2 size={16} /> Distribuir
              </button>
            </div>
          </article>
        ))}
      </div>

      {criando && <NovaCampanha onClose={() => setCriando(false)} />}

      {distribuindo && (
        <DistribuirModal
          titulo={`Distribuir: ${distribuindo.nome}`}
          descricao="Os leads da campanha que ainda estão sem responsável serão repartidos entre os promotores marcados."
          onClose={() => {
            setDistribuindo(null);
            qc.invalidateQueries({ queryKey: ['/leads'] });
          }}
          onDistribuir={({ usuarioIds, quantidade }) =>
            api(`/campanhas/${distribuindo.id}/distribuir`, { method: 'POST', body: { usuarioIds, quantidade } })
          }
        />
      )}
    </>
  );
}
