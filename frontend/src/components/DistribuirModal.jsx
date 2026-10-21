import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useEquipe } from '../lib/useEquipe.js';
import Modal from './Modal.jsx';
import { Carregando } from './Estados.jsx';

/**
 * Escolha de promotores (e quantidade) para repartir leads em rodízio.
 * origens: [{ valor, rotulo }] opcional, para escolher de onde sair os leads.
 * onDistribuir({ usuarioIds, quantidade, origem }) -> { distribuidos, porUsuario }
 */
export default function DistribuirModal({ titulo = 'Distribuir leads', descricao, origens, onDistribuir, onClose }) {
  const { promotores, carregando } = useEquipe();
  const [marcados, setMarcados] = useState([]);
  const [quantidade, setQuantidade] = useState('');
  const [origem, setOrigem] = useState(origens?.[0]?.valor ?? '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  const alternar = (id) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const distribuir = async () => {
    setErro('');
    setEnviando(true);
    try {
      setResultado(
        await onDistribuir({
          usuarioIds: marcados,
          quantidade: quantidade ? Number(quantidade) : undefined,
          origem,
        }),
      );
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={titulo} onClose={onClose}>
      {resultado ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            <p className="font-semibold">
              {resultado.distribuidos.toLocaleString('pt-BR')} leads distribuídos
            </p>
            <ul className="mt-1">
              {resultado.porUsuario.map((u) => (
                <li key={u.usuarioId}>
                  {u.nome}: {u.quantidade.toLocaleString('pt-BR')}
                </li>
              ))}
            </ul>
            {resultado.distribuidos === 0 && <p>Não havia leads sem responsável nessa origem.</p>}
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={onClose}>Concluir</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {descricao && <p className="text-sm text-muted">{descricao}</p>}

          {origens && (
            <div>
              <label className="label" htmlFor="origem">De onde tirar os leads</label>
              <select id="origem" className="input" value={origem} onChange={(e) => setOrigem(e.target.value)}>
                {origens.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="label">Promotores</span>
            {carregando && <Carregando />}
            {!carregando && promotores.length === 0 && (
              <p className="rounded-xl bg-surface2 p-3 text-sm text-muted">
                Nenhum promotor na sua equipe. Cadastre promotores primeiro.
              </p>
            )}
            <ul className="space-y-1">
              {promotores.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface2">
                    <input
                      type="checkbox"
                      checked={marcados.includes(p.id)}
                      onChange={() => alternar(p.id)}
                      className="h-4 w-4 accent-[rgb(var(--primary))]"
                    />
                    <span className="text-sm">{p.nome}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="label" htmlFor="qtd">Quantidade total (vazio = todos os leads sem responsável)</label>
            <input
              id="qtd"
              type="number"
              min="1"
              className="input max-w-[12rem]"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>

          {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{erro}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!marcados.length || enviando} onClick={distribuir}>
              {enviando && <Loader2 size={16} className="animate-spin" />} Distribuir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
