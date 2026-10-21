import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { dataHoraBR } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Carregando, LinhasSkeleton } from '../components/Estados.jsx';

const PERFIS = {
  MASTER: { rotulo: 'Master', cor: 'bg-primary/15 text-primary' },
  GERENTE: { rotulo: 'Gerente', cor: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  SUPERVISOR: { rotulo: 'Supervisor', cor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  BKO: { rotulo: 'BKO', cor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  PROMOTOR: { rotulo: 'Promotor', cor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
};

// Perfis que cada perfil pode criar (espelha o que o servidor permite)
const CRIAVEIS = {
  MASTER: ['MASTER', 'GERENTE', 'SUPERVISOR', 'BKO', 'PROMOTOR'],
  SUPERVISOR: ['BKO', 'PROMOTOR'],
};

const Selo = ({ perfil }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PERFIS[perfil].cor}`}>{PERFIS[perfil].rotulo}</span>
);

function Caixa({ rotulo, dica, checked, onChange, desabilitado }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl px-3 py-2 ${desabilitado ? 'opacity-50' : 'cursor-pointer hover:bg-surface2'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={desabilitado}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]"
      />
      <span className="text-sm">
        {rotulo}
        {dica && <span className="block text-xs text-muted">{dica}</span>}
      </span>
    </label>
  );
}

// ---------- Acesso por IP (master) ----------
function AcessoModal({ usuario, onClose }) {
  const [ips, setIps] = useState(null);
  const [travar, setTravar] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  const { data: info, isLoading } = useQuery({
    queryKey: ['/acesso', usuario.id],
    queryFn: () => api(`/acesso/${usuario.id}`),
    gcTime: 0,
  });

  const lista = ips ?? (info?.ips ?? []).join('\n');
  const travarAtual = ips === null ? info?.travarPrimeiroLogin ?? false : travar;

  const salvar = useMutation({
    mutationFn: () =>
      api(`/acesso/${usuario.id}`, {
        method: 'PUT',
        body: {
          ips: lista.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
          travarPrimeiroLogin: travarAtual,
        },
      }),
    onSuccess: () => {
      setErro('');
      setOk(true);
    },
    onError: (e) => {
      setOk(false);
      setErro(e.message);
    },
  });

  const editar = (valor) => {
    setIps(valor);
    setTravar(travarAtual);
    setOk(false);
  };

  return (
    <Modal titulo={`Acesso por IP: ${usuario.nome}`} onClose={onClose}>
      {isLoading ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Com a lista vazia, o acesso é livre. Com IPs na lista, o login só funciona desses locais. Cada novo login
            encerra a sessão anterior.
          </p>
          {info?.travaDesligada && (
            <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              O controle de acesso está desligado no servidor (CONTROLE_ACESSO_DESLIGADO).
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface2 p-3">
              <dt className="text-xs text-muted">Seu IP agora</dt>
              <dd className="font-medium">{info.ipAtual || '—'}</dd>
            </div>
            <div className="rounded-xl bg-surface2 p-3">
              <dt className="text-xs text-muted">Último acesso</dt>
              <dd className="font-medium">
                {info.ultimoIp ? `${info.ultimoIp} · ${dataHoraBR(info.ultimoAcessoEm)}` : '—'}
              </dd>
            </div>
            {info.ipBloqueado && (
              <div className="col-span-2 rounded-xl bg-primary/10 p-3">
                <dt className="text-xs text-muted">Última tentativa bloqueada</dt>
                <dd className="font-medium">{info.ipBloqueado} · {dataHoraBR(info.ipBloqueadoEm)}</dd>
              </div>
            )}
          </dl>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="label !mb-0" htmlFor="ips">IPs liberados (um por linha)</label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => info.ipAtual && !lista.includes(info.ipAtual) && editar(`${lista ? `${lista}\n` : ''}${info.ipAtual}`)}
              >
                Adicionar meu IP atual
              </button>
            </div>
            <textarea id="ips" rows={4} className="input font-mono" value={lista} onChange={(e) => editar(e.target.value)} />
          </div>

          <Caixa
            rotulo="Travar no IP do primeiro login"
            dica="Vale só com a lista vazia: o IP do próximo login vira o IP liberado."
            checked={travarAtual}
            desabilitado={lista.trim() !== ''}
            onChange={(v) => {
              setIps(lista);
              setTravar(v);
              setOk(false);
            }}
          />

          {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{erro}</p>}
          {ok && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">Salvo.</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose}>Fechar</button>
            <button className="btn-primary" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Cadastro / edição ----------
function UsuarioModal({ usuario, usuarios, onClose }) {
  const { usuario: eu } = useAuth();
  const qc = useQueryClient();
  const novo = !usuario.id;
  const criaveis = CRIAVEIS[eu.perfil] ?? [];
  const master = eu.perfil === 'MASTER';
  const supervisores = usuarios.filter((u) => u.perfil === 'SUPERVISOR' && u.ativo);

  const [f, setF] = useState({
    perfil: usuario.perfil ?? criaveis.at(-1),
    nome: usuario.nome ?? '',
    email: usuario.email ?? '',
    senha: '',
    cargo: usuario.cargo ?? '',
    departamento: usuario.departamento ?? '',
    telefone: usuario.telefone ?? '',
    superiorId: usuario.superiorId ?? (supervisores[0]?.id ?? eu.id),
    permissaoImportacao: usuario.permissaoImportacao ?? false,
    verTodasImob: Array.isArray(usuario.permissoes) && usuario.permissoes.includes('imob_ver_todas'),
    ativo: usuario.ativo ?? true,
    supervisoresGerenciados: usuario.supervisoresGerenciados ?? [],
  });
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const precisaSuperior = master && novo && ['BKO', 'PROMOTOR'].includes(f.perfil);
  const acompanha = master && ['GERENTE', 'BKO'].includes(f.perfil);
  // Permissões só fazem sentido para quem trabalha com bases e propostas
  const comPermissoes = f.perfil !== 'MASTER';

  const salvar = useMutation({
    mutationFn: () => {
      const permissoes = (usuario.permissoes ?? []).filter((p) => p !== 'imob_ver_todas');
      if (f.verTodasImob) permissoes.push('imob_ver_todas');

      const comum = {
        nome: f.nome,
        cargo: f.cargo || undefined,
        departamento: f.departamento || undefined,
        telefone: f.telefone || undefined,
        permissaoImportacao: f.permissaoImportacao,
        permissoes,
        ...(acompanha && { supervisoresGerenciados: f.supervisoresGerenciados }),
      };

      return novo
        ? api('/usuarios', {
            method: 'POST',
            body: { ...comum, perfil: f.perfil, email: f.email, senha: f.senha, ...(precisaSuperior && { superiorId: f.superiorId }) },
          })
        : api(`/usuarios/${usuario.id}`, {
            method: 'PUT',
            body: { ...comum, ativo: f.ativo, ...(f.senha && { senha: f.senha }) },
          });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/usuarios'] });
      onClose();
    },
    onError: (e) => setErro(e.message),
  });

  const alternarSup = (id) =>
    setF((x) => ({
      ...x,
      supervisoresGerenciados: x.supervisoresGerenciados.includes(id)
        ? x.supervisoresGerenciados.filter((s) => s !== id)
        : [...x.supervisoresGerenciados, id],
    }));

  return (
    <Modal titulo={novo ? 'Novo usuário' : `Editar: ${usuario.nome}`} onClose={onClose} largura="max-w-2xl">
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErro('');
          salvar.mutate();
        }}
      >
        {novo ? (
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="perfil">Perfil <span className="text-primary">*</span></label>
            <select id="perfil" className="input" value={f.perfil} onChange={set('perfil')}>
              {criaveis.map((p) => (
                <option key={p} value={p}>{PERFIS[p].rotulo}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="col-span-2 sm:col-span-1">
            <span className="label">Perfil</span>
            <div className="py-2"><Selo perfil={usuario.perfil} /></div>
          </div>
        )}

        {precisaSuperior && (
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="superior">Supervisor responsável</label>
            <select id="superior" className="input" value={f.superiorId} onChange={set('superiorId')}>
              <option value={eu.id}>Eu mesmo (master)</option>
              {supervisores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="nome">Nome <span className="text-primary">*</span></label>
          <input id="nome" className="input" required minLength={2} value={f.nome} onChange={set('nome')} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="email">E-mail (login) <span className="text-primary">*</span></label>
          <input id="email" type="email" className="input" required disabled={!novo} value={f.email} onChange={set('email')} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="senha">
            {novo ? 'Senha' : 'Nova senha (deixe vazio para manter)'}
            {novo && <span className="text-primary"> *</span>}
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="new-password"
            className="input"
            required={novo}
            minLength={8}
            value={f.senha}
            onChange={set('senha')}
          />
          <p className="mt-1 text-xs text-muted">Mínimo de 8 caracteres.</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="telefone">Telefone</label>
          <input id="telefone" type="tel" className="input" value={f.telefone} onChange={set('telefone')} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="cargo">Cargo</label>
          <input id="cargo" className="input" value={f.cargo} onChange={set('cargo')} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="departamento">Departamento</label>
          <input id="departamento" className="input" value={f.departamento} onChange={set('departamento')} />
        </div>

        {comPermissoes && (
          <div className="col-span-2">
            <span className="label">Permissões</span>
            <Caixa
              rotulo="Pode importar bases"
              dica="Libera a importação de planilhas na tela Bases (o master sempre pode)."
              checked={f.permissaoImportacao}
              onChange={(v) => setF((x) => ({ ...x, permissaoImportacao: v }))}
            />
            <Caixa
              rotulo="Ver todas as propostas imobiliárias"
              dica="Sem isso, o promotor vê só as propostas que ele criou."
              checked={f.verTodasImob}
              onChange={(v) => setF((x) => ({ ...x, verTodasImob: v }))}
            />
          </div>
        )}

        {acompanha && (
          <div className="col-span-2">
            <span className="label">Supervisores acompanhados</span>
            {supervisores.length === 0 ? (
              <p className="rounded-xl bg-surface2 p-3 text-sm text-muted">Cadastre supervisores primeiro.</p>
            ) : (
              <ul className="max-h-40 overflow-y-auto">
                {supervisores.map((s) => (
                  <li key={s.id}>
                    <Caixa
                      rotulo={s.nome}
                      checked={f.supervisoresGerenciados.includes(s.id)}
                      onChange={() => alternarSup(s.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!novo && (
          <div className="col-span-2">
            <Caixa
              rotulo="Usuário ativo"
              dica="Desativar impede o login, mas preserva o histórico."
              checked={f.ativo}
              desabilitado={usuario.id === eu.id}
              onChange={(v) => setF((x) => ({ ...x, ativo: v }))}
            />
          </div>
        )}

        {erro && <p className="col-span-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary" role="alert">{erro}</p>}

        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 size={16} className="animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Página ----------
export default function Usuarios() {
  const { usuario: eu } = useAuth();
  const [q, setQ] = useState('');
  const [perfil, setPerfil] = useState('');
  const [editando, setEditando] = useState(null);
  const [acesso, setAcesso] = useState(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['/usuarios'],
    queryFn: () => api('/usuarios'),
    select: (r) => r.usuarios,
  });

  const nomes = Object.fromEntries(data.map((u) => [u.id, u.nome]));
  const filtrados = data.filter(
    (u) =>
      (!perfil || u.perfil === perfil) &&
      (!q || `${u.nome} ${u.email}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader titulo="Usuários" descricao="Cadastre a equipe, defina permissões e redefina senhas.">
        <button className="btn-primary" onClick={() => setEditando({})}>
          <Plus size={16} /> Novo usuário
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
          <option value="">Todos os perfis</option>
          {Object.entries(PERFIS).map(([v, p]) => (
            <option key={v} value={v}>{p.rotulo}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
              <tr>
                {['Usuário', 'Perfil', 'Responsável', 'Último acesso', 'Situação', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtrados.map((u) => (
                <tr key={u.id} className="cursor-pointer transition hover:bg-surface2/60" onClick={() => setEditando(u)}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium">{u.nome}{u.id === eu.id && <span className="ml-2 text-xs text-muted">(você)</span>}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3"><Selo perfil={u.perfil} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{u.superiorId ? nomes[u.superiorId] ?? '—' : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{u.ultimoLogin ? dataHoraBR(u.ultimoLogin) : 'nunca'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={u.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {eu.perfil === 'MASTER' && u.perfil === 'MASTER' && (
                      <button
                        className="btn-ghost !px-2.5 !py-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAcesso(u);
                        }}
                      >
                        <ShieldCheck size={14} /> Acesso por IP
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <LinhasSkeleton colunas={5} />}
        {error && <p className="p-6 text-center text-sm text-primary">{error.message}</p>}
        {!isLoading && filtrados.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhum usuário encontrado.</p>}
      </div>

      {editando && <UsuarioModal key={editando.id ?? 'novo'} usuario={editando} usuarios={data} onClose={() => setEditando(null)} />}
      {acesso && <AcessoModal usuario={acesso} onClose={() => setAcesso(null)} />}
    </>
  );
}
