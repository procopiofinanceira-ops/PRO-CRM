import { Fragment, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';

/**
 * Formulário em modal dirigido por configuração.
 * campos: [{ chave, rotulo, tipo: text|textarea|number|date|datetime|select|checkbox|email|tel,
 *            opcoes: [{valor, rotulo}], obrigatorio, largura: 'meia' }]
 * valores: estado inicial (já no formato dos inputs)
 * onSubmit(valores) -> Promise; lance Error para exibir mensagem.
 */
export default function FormModal({ titulo, campos, valores, onSubmit, onClose, onExcluir, largura }) {
  const [form, setForm] = useState(valores);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const alterar = (chave, valor) => setForm((f) => ({ ...f, [chave]: valor }));

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={titulo} onClose={onClose} largura={largura}>
      <form onSubmit={enviar} className="grid grid-cols-2 gap-4">
        {campos.map((c) => (
          <Fragment key={c.chave}>
          {c.secao && (
            <h3 className="col-span-2 mt-3 border-b border-line pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0">
              {c.secao}
            </h3>
          )}
          <div className={c.largura === 'meia' ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
            {c.tipo === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form[c.chave])}
                  onChange={(e) => alterar(c.chave, e.target.checked)}
                  className="h-4 w-4 accent-[rgb(var(--primary))]"
                />
                {c.rotulo}
              </label>
            ) : (
              <>
                <label className="label" htmlFor={c.chave}>
                  {c.rotulo}
                  {c.obrigatorio && <span className="text-primary"> *</span>}
                </label>
                {c.tipo === 'textarea' ? (
                  <textarea
                    id={c.chave}
                    rows={3}
                    className="input"
                    value={form[c.chave] ?? ''}
                    onChange={(e) => alterar(c.chave, e.target.value)}
                  />
                ) : c.tipo === 'select' ? (
                  <select
                    id={c.chave}
                    className="input"
                    value={form[c.chave] ?? ''}
                    onChange={(e) => alterar(c.chave, e.target.value)}
                  >
                    {!c.obrigatorio && <option value="">—</option>}
                    {c.opcoes.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={c.chave}
                    className="input"
                    type={c.tipo === 'datetime' ? 'datetime-local' : c.tipo || 'text'}
                    step={c.tipo === 'number' ? 'any' : undefined}
                    required={c.obrigatorio}
                    value={form[c.chave] ?? ''}
                    onChange={(e) => alterar(c.chave, e.target.value)}
                  />
                )}
              </>
            )}
          </div>
          </Fragment>
        ))}

        {erro && (
          <p className="col-span-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary" role="alert">
            {erro}
          </p>
        )}

        <div className="col-span-2 mt-1 flex items-center justify-between gap-2">
          {onExcluir ? (
            <button
              type="button"
              className="btn-ghost text-primary"
              onClick={async () => {
                if (!window.confirm('Excluir este registro?')) return;
                await onExcluir();
                onClose();
              }}
            >
              <Trash2 size={16} /> Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Converte valores do formulário em payload da API (números e vazios). */
export function paraPayload(campos, form) {
  const out = {};
  for (const c of campos) {
    let v = form[c.chave];
    if (c.tipo === 'number') v = v === '' || v == null ? null : Number(v);
    else if (c.tipo === 'datetime') v = v ? new Date(v).toISOString() : null;
    else if (c.tipo === 'checkbox') v = Boolean(v);
    else if (v === '') v = c.tipo === 'select' && c.obrigatorio ? undefined : null;
    out[c.chave] = v;
  }
  return out;
}
