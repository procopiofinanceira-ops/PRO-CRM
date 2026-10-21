import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Loader2, Search, Upload } from 'lucide-react';
import { api } from '../lib/api.js';
import { lerPlanilha } from '../lib/planilha.js';
import { CAMPOS_POR_GRUPO, detectarCampo, montarRegistro } from '../lib/mapeamento.js';
import Modal from './Modal.jsx';

const LOTE = 300;
const PASSOS = ['Convênio', 'Arquivo', 'Colunas', 'Importar'];

function Indicador({ passo }) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {PASSOS.map((nome, i) => {
        const n = i + 1;
        const feito = n < passo;
        const atual = n === passo;
        return (
          <li key={nome} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                feito || atual ? 'bg-primary text-primary-fg' : 'bg-surface2 text-muted'
              }`}
            >
              {feito ? <Check size={14} /> : n}
            </span>
            <span className={`hidden text-xs sm:block ${atual ? 'font-medium' : 'text-muted'}`}>{nome}</span>
            {n < PASSOS.length && <span className="h-px flex-1 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Passo 1: convênio ----------
function PassoConvenio({ convenio, setConvenio }) {
  const [busca, setBusca] = useState(convenio.nome);
  const { data: cadastrados = [] } = useQuery({
    queryKey: ['/convenios-completos', {}],
    queryFn: () => api('/convenios-completos'),
    select: (r) => r.itens,
  });

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return cadastrados
      .filter((c) => c.nome.toLowerCase().includes(q) || c.codigo?.includes(q))
      .slice(0, 6);
  }, [busca, cadastrados]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Escolha um convênio já cadastrado ou digite o nome. Os leads importados ficam vinculados a ele.
      </p>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input pl-9"
          placeholder="Nome ou código do convênio…"
          value={busca}
          autoFocus
          onChange={(e) => {
            setBusca(e.target.value);
            setConvenio({ nome: e.target.value, codigo: '' });
          }}
        />
      </div>

      {sugestoes.length > 0 && convenio.codigo === '' && (
        <ul className="card divide-y divide-line overflow-hidden">
          {sugestoes.map((c) => (
            <li key={c.id}>
              <button
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-surface2"
                onClick={() => {
                  setConvenio({ nome: c.nome, codigo: c.codigo ?? '' });
                  setBusca(c.nome);
                }}
              >
                <span className="font-medium">{c.nome}</span>
                <span className="text-xs text-muted">{c.codigo ? `Cód. ${c.codigo}` : 'sem código'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className="label" htmlFor="cod-conv">
          Código do convênio (opcional)
        </label>
        <input
          id="cod-conv"
          className="input max-w-xs"
          value={convenio.codigo}
          onChange={(e) => setConvenio({ ...convenio, codigo: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted">
          Usado para identificar CPFs repetidos dentro do mesmo convênio.
        </p>
      </div>
    </div>
  );
}

// ---------- Passo 2: arquivo ----------
function PassoArquivo({ planilha, setPlanilha, setMapeamento }) {
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);
  const input = useRef(null);

  const escolher = async (arquivo) => {
    if (!arquivo) return;
    setErro('');
    setLendo(true);
    try {
      const { cabecalhos, linhas } = await lerPlanilha(arquivo);
      setPlanilha({ nome: arquivo.name, cabecalhos, linhas });
      setMapeamento(Object.fromEntries(cabecalhos.map((c, i) => [i, detectarCampo(c)])));
    } catch (e) {
      setPlanilha(null);
      setErro(e.message);
    } finally {
      setLendo(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          escolher(e.dataTransfer.files?.[0]);
        }}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center transition hover:border-primary hover:bg-primary/5"
      >
        {lendo ? <Loader2 className="animate-spin text-primary" /> : <Upload className="text-primary" />}
        <span className="text-sm font-medium">Arraste a planilha aqui ou clique para escolher</span>
        <span className="text-xs text-muted">.xlsx, .xls ou .csv, até 25 MB</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => escolher(e.target.files?.[0])}
      />

      {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{erro}</p>}

      {planilha && (
        <div className="flex items-center gap-3 rounded-xl bg-surface2 p-4">
          <FileSpreadsheet className="text-primary" />
          <div className="text-sm">
            <p className="font-medium">{planilha.nome}</p>
            <p className="text-xs text-muted">
              {planilha.linhas.length.toLocaleString('pt-BR')} linhas · {planilha.cabecalhos.length} colunas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Passo 3: mapeamento ----------
function PassoMapeamento({ planilha, mapeamento, setMapeamento, repetidos }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Indique o que cada coluna representa. Sugerimos automaticamente; ajuste o que precisar.
      </p>
      <div className="card overflow-hidden">
        <div className="max-h-[45vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Coluna da planilha</th>
                <th className="px-4 py-2.5 font-medium">Exemplo</th>
                <th className="px-4 py-2.5 font-medium">Importar como</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {planilha.cabecalhos.map((c, i) => {
                const campo = mapeamento[i] ?? '';
                const exemplo = planilha.linhas.slice(0, 3).map((l) => l[i]).filter((v) => String(v).trim() !== '')[0];
                return (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium">{c}</td>
                    <td className="max-w-[10rem] truncate px-4 py-2 text-muted">{String(exemplo ?? '—')}</td>
                    <td className="px-4 py-2">
                      <select
                        className={`input !py-1.5 ${repetidos.has(campo) ? 'border-primary' : ''}`}
                        value={campo}
                        onChange={(e) => setMapeamento((m) => ({ ...m, [i]: e.target.value }))}
                      >
                        <option value="">— Não importar —</option>
                        {CAMPOS_POR_GRUPO.map((g) => (
                          <optgroup key={g.grupo} label={g.grupo}>
                            {g.campos.map((f) => (
                              <option key={f.valor} value={f.valor}>
                                {f.rotulo}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- Passo 4: importar ----------
function PassoImportar({ convenio, planilha, mapeamento, estado }) {
  const campos = Object.values(mapeamento).filter(Boolean).length;
  const { fase, enviados, resultado, erro } = estado;
  const total = planilha.linhas.length;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {[
          ['Convênio', convenio.nome],
          ['Código', convenio.codigo || '—'],
          ['Arquivo', planilha.nome],
          ['Linhas', total.toLocaleString('pt-BR')],
          ['Colunas importadas', campos],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface2 p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-0.5 truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {fase === 'enviando' && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Importando…</span>
            <span>{Math.min(100, Math.round((enviados / total) * 100))}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(enviados / total) * 100}%` }} />
          </div>
        </div>
      )}

      {fase === 'ok' && (
        <div className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
          <p className="font-semibold">Importação concluída</p>
          <p>
            {resultado.inseridos.toLocaleString('pt-BR')} leads importados
            {resultado.duplicados > 0 && ` · ${resultado.duplicados.toLocaleString('pt-BR')} duplicados ignorados`}.
          </p>
        </div>
      )}

      {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{erro}</p>}
    </div>
  );
}

// ---------- Assistente ----------
export default function ImportWizard({ onClose, onConcluido }) {
  const [passo, setPasso] = useState(1);
  const [convenio, setConvenio] = useState({ nome: '', codigo: '' });
  const [planilha, setPlanilha] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [estado, setEstado] = useState({ fase: 'parado', enviados: 0, resultado: null, erro: '' });

  const repetidos = useMemo(() => {
    const vistos = new Set();
    const rep = new Set();
    for (const campo of Object.values(mapeamento)) {
      if (!campo) continue;
      if (vistos.has(campo)) rep.add(campo);
      vistos.add(campo);
    }
    return rep;
  }, [mapeamento]);

  const mapeados = new Set(Object.values(mapeamento).filter(Boolean));

  const bloqueio =
    passo === 1 ? (convenio.nome.trim().length < 2 ? 'Informe o convênio.' : '')
    : passo === 2 ? (!planilha ? 'Escolha uma planilha.' : '')
    : passo === 3 ? (repetidos.size ? 'Há campos usados em mais de uma coluna.'
        : !mapeados.has('cpf') ? 'Mapeie a coluna do CPF para continuar.' : '')
    : '';

  const importar = async () => {
    setEstado({ fase: 'enviando', enviados: 0, resultado: null, erro: '' });
    let importacaoId = null;
    try {
      const { item } = await api('/importacoes', {
        method: 'POST',
        body: {
          arquivo: planilha.nome,
          convenio: convenio.nome.trim(),
          codConvenio: convenio.codigo.trim() || undefined,
          origem: 'planilha',
        },
      });
      importacaoId = item.id;

      const registros = planilha.linhas.map((l) => montarRegistro(l, mapeamento));
      const resultado = { inseridos: 0, duplicados: 0 };

      for (let i = 0; i < registros.length; i += LOTE) {
        const r = await api(`/importacoes/${importacaoId}/registros`, {
          method: 'POST',
          body: { registros: registros.slice(i, i + LOTE) },
        });
        resultado.inseridos += r.inseridos;
        resultado.duplicados += r.duplicados;
        setEstado((s) => ({ ...s, enviados: Math.min(i + LOTE, registros.length) }));
      }

      await api(`/importacoes/${importacaoId}/concluir`, { method: 'POST' });
      setEstado({ fase: 'ok', enviados: registros.length, resultado, erro: '' });
      onConcluido?.();
    } catch (e) {
      // Desfaz a importação incompleta para não deixar lixo na base
      if (importacaoId) await api(`/importacoes/${importacaoId}`, { method: 'DELETE' }).catch(() => {});
      setEstado({ fase: 'erro', enviados: 0, resultado: null, erro: `Falha na importação: ${e.message}` });
    }
  };

  const emEnvio = estado.fase === 'enviando';

  return (
    <Modal titulo="Nova importação" onClose={emEnvio ? () => {} : onClose} largura="max-w-3xl">
      <Indicador passo={passo} />

      {passo === 1 && <PassoConvenio convenio={convenio} setConvenio={setConvenio} />}
      {passo === 2 && <PassoArquivo planilha={planilha} setPlanilha={setPlanilha} setMapeamento={setMapeamento} />}
      {passo === 3 && (
        <PassoMapeamento planilha={planilha} mapeamento={mapeamento} setMapeamento={setMapeamento} repetidos={repetidos} />
      )}
      {passo === 4 && <PassoImportar convenio={convenio} planilha={planilha} mapeamento={mapeamento} estado={estado} />}

      <div className="mt-6 flex items-center justify-between gap-3">
        {passo > 1 && estado.fase !== 'ok' ? (
          <button className="btn-outline" disabled={emEnvio} onClick={() => setPasso(passo - 1)}>
            <ArrowLeft size={16} /> Voltar
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          {bloqueio && passo < 4 && <span className="hidden text-xs text-muted sm:block">{bloqueio}</span>}
          {passo < 4 && (
            <button className="btn-primary" disabled={Boolean(bloqueio)} onClick={() => setPasso(passo + 1)}>
              Continuar <ArrowRight size={16} />
            </button>
          )}
          {passo === 4 && estado.fase !== 'ok' && (
            <button className="btn-primary" disabled={emEnvio} onClick={importar}>
              {emEnvio && <Loader2 size={16} className="animate-spin" />} Importar
            </button>
          )}
          {estado.fase === 'ok' && (
            <button className="btn-primary" onClick={onClose}>
              Concluir
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
