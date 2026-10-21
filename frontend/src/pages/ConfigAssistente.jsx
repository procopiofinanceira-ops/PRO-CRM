import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Loader2, Trash2, XCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando } from '../components/Estados.jsx';

export default function ConfigAssistente() {
  const qc = useQueryClient();
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['/assistente/config'],
    queryFn: () => api('/assistente/config'),
    gcTime: 0,
  });

  const [provedor, setProvedor] = useState('anthropic');
  const [ativo, setAtivo] = useState(true);
  const [extras, setExtras] = useState('');
  const [chaves, setChaves] = useState({});
  const [modelos, setModelos] = useState({});
  const [remover, setRemover] = useState([]);
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'erro', texto }
  const [teste, setTeste] = useState(null);

  // Carrega os valores salvos quando a configuração chega
  useEffect(() => {
    if (!config) return;
    setProvedor(config.provedor);
    setAtivo(config.ativo);
    setExtras(config.instrucoesExtras);
    setModelos(Object.fromEntries(Object.entries(config.provedores).map(([id, p]) => [id, p.modelo])));
    setChaves({});
    setRemover([]);
  }, [config]);

  const salvar = useMutation({
    mutationFn: () =>
      api('/assistente/config', {
        method: 'PUT',
        body: { provedor, ativo, instrucoesExtras: extras, chaves, modelos, removerChaves: remover },
      }),
    onSuccess: (nova) => {
      qc.setQueryData(['/assistente/config'], nova);
      qc.invalidateQueries({ queryKey: ['/assistente/status'] });
      setAviso({ tipo: 'ok', texto: 'Configuração salva.' });
    },
    onError: (e) => setAviso({ tipo: 'erro', texto: e.message }),
  });

  const testar = useMutation({
    mutationFn: () => api('/assistente/config/testar', { method: 'POST', body: { provedor } }),
    onSuccess: (r) => setTeste({ ok: true, texto: `Conexão funcionando (modelo ${r.modelo}).` }),
    onError: (e) => setTeste({ ok: false, texto: e.message }),
  });

  if (isLoading) return <Carregando />;
  if (error) return <p className="text-sm text-primary">{error.message}</p>;

  const p = config.provedores[provedor];
  const removendo = remover.includes(provedor);
  const pendente = Boolean(chaves[provedor]) || removendo;

  return (
    <>
      <PageHeader titulo="Assistente virtual" descricao="Escolha o provedor de IA que responde as dúvidas da equipe sobre o sistema." />

      <div className="grid max-w-3xl gap-5">
        <section className="card space-y-5 p-5">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary))]" />
            <span className="text-sm font-medium">Assistente ativo para a equipe</span>
          </label>

          <div>
            <label className="label" htmlFor="provedor">Provedor em uso</label>
            <select
              id="provedor"
              className="input max-w-sm"
              value={provedor}
              onChange={(e) => {
                setProvedor(e.target.value);
                setTeste(null);
              }}
            >
              {Object.entries(config.provedores).map(([id, x]) => (
                <option key={id} value={id}>{x.nome}{x.configurado ? ' · chave salva' : ''}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-line p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound size={16} className="text-primary" />
              <h2 className="text-sm font-semibold">{p.nome}</h2>
              {p.configurado && !removendo ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> chave salva (termina em {p.final})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted"><XCircle size={14} /> sem chave</span>
              )}
            </div>

            {p.chaveIlegivel && (
              <p className="mb-3 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                A chave salva não pôde ser lida (a chave de cifragem do servidor mudou). Informe-a de novo.
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="chave">{p.configurado ? 'Trocar a chave de API' : 'Chave de API'}</label>
                <input
                  id="chave"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className="input"
                  placeholder={p.configurado ? '•••••••• (deixe vazio para manter)' : 'Cole a chave aqui'}
                  value={chaves[provedor] ?? ''}
                  onChange={(e) => {
                    setChaves((c) => ({ ...c, [provedor]: e.target.value }));
                    setRemover((r) => r.filter((x) => x !== provedor));
                  }}
                />
                <p className="mt-1 text-xs text-muted">A chave fica cifrada no servidor e nunca volta para o navegador.</p>
              </div>

              <div>
                <label className="label" htmlFor="modelo">Modelo</label>
                <input
                  id="modelo"
                  className="input max-w-sm"
                  value={modelos[provedor] ?? ''}
                  onChange={(e) => setModelos((m) => ({ ...m, [provedor]: e.target.value }))}
                  placeholder={p.modeloPadrao}
                />
                <p className="mt-1 text-xs text-muted">Padrão: {p.modeloPadrao}. Vazio usa o padrão.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn-outline"
                  disabled={testar.isPending || !p.configurado || pendente}
                  title={pendente ? 'Salve as alterações antes de testar' : undefined}
                  onClick={() => {
                    setTeste(null);
                    testar.mutate();
                  }}
                >
                  {testar.isPending && <Loader2 size={16} className="animate-spin" />} Testar conexão
                </button>
                {p.configurado && (
                  <button
                    className="btn-ghost text-primary"
                    onClick={() => setRemover((r) => (r.includes(provedor) ? r : [...r, provedor]))}
                    disabled={removendo}
                  >
                    <Trash2 size={16} /> Remover chave
                  </button>
                )}
              </div>

              {teste && (
                <p className={`rounded-xl px-3 py-2 text-sm ${teste.ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                  {teste.texto}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="extras">Orientações adicionais (opcional)</label>
            <textarea
              id="extras"
              rows={5}
              maxLength={8000}
              className="input"
              value={extras}
              onChange={(e) => setExtras(e.target.value)}
              placeholder="Ex.: regras internas, nomes de produtos, como a equipe deve tratar o cliente…"
            />
            <p className="mt-1 text-xs text-muted">{extras.length}/8000 · Entram no contexto de todas as respostas.</p>
          </div>

          {aviso && (
            <p className={`rounded-xl px-3 py-2 text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
              {aviso.texto}
            </p>
          )}

          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={salvar.isPending}
              onClick={() => {
                setAviso(null);
                salvar.mutate();
              }}
            >
              {salvar.isPending && <Loader2 size={16} className="animate-spin" />} Salvar configuração
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
