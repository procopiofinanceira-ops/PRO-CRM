import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import Modal from './Modal.jsx';

export default function AlterarSenhaModal({ onClose }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (nova !== confirma) return setErro('A confirmação não confere com a nova senha.');
    setSalvando(true);
    try {
      await api('/auth/alterar-senha', { method: 'POST', body: { senhaAtual: atual, novaSenha: nova } });
      setPronto(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo="Alterar senha" onClose={onClose}>
      {pronto ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">Senha alterada com sucesso.</p>
          <div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Fechar</button></div>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          {[
            ['atual', 'Senha atual', atual, setAtual, 'current-password'],
            ['nova', 'Nova senha (mínimo 8 caracteres)', nova, setNova, 'new-password'],
            ['confirma', 'Confirmar nova senha', confirma, setConfirma, 'new-password'],
          ].map(([id, rotulo, valor, set, auto]) => (
            <div key={id}>
              <label className="label" htmlFor={id}>{rotulo}</label>
              <input id={id} type="password" autoComplete={auto} className="input" required minLength={id === 'atual' ? 1 : 8} value={valor} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
          {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={salvando}>
              {salvando && <Loader2 size={16} className="animate-spin" />} Alterar senha
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
