import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';

const LADO = 192; // a foto final é um quadrado pequeno: leve para guardar e para listar

/** Recorta o centro da imagem em quadrado (com zoom) e devolve um JPEG em texto. */
function recortar(imagem, zoom) {
  const canvas = document.createElement('canvas');
  canvas.width = LADO;
  canvas.height = LADO;
  const lado = Math.min(imagem.width, imagem.height) / zoom;
  const sx = (imagem.width - lado) / 2;
  const sy = (imagem.height - lado) / 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, LADO, LADO);
  ctx.drawImage(imagem, sx, sy, lado, lado, 0, 0, LADO, LADO);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function FotoPerfilModal({ onClose }) {
  const { usuario, atualizarUsuario } = useAuth();
  const toast = useToast();
  const entrada = useRef(null);
  const [imagem, setImagem] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [previa, setPrevia] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (imagem) setPrevia(recortar(imagem, zoom));
  }, [imagem, zoom]);

  const escolher = (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) return setErro('Escolha um arquivo de imagem.');
    setErro('');
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setZoom(1);
      setImagem(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErro('Não foi possível abrir essa imagem.');
    };
    img.src = url;
  };

  const enviar = async (fn, mensagem) => {
    setSalvando(true);
    setErro('');
    try {
      const r = await fn();
      atualizarUsuario(r.usuario);
      toast.sucesso(mensagem);
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const salvar = () => enviar(() => api('/auth/foto', { method: 'PUT', body: { foto: previa } }), 'Foto atualizada.');
  const remover = () => enviar(() => api('/auth/foto', { method: 'DELETE' }), 'Foto removida.');

  return (
    <Modal titulo="Foto do perfil" onClose={onClose} largura="max-w-sm">
      <div className="space-y-4">
        <div className="flex justify-center">
          <Avatar usuario={previa ? { ...usuario, fotoUrl: previa } : usuario} className="h-32 w-32 text-4xl ring-2 ring-primary/40" />
        </div>

        {imagem && (
          <div>
            <label className="label" htmlFor="zoom-foto">Aproximar</label>
            <input
              id="zoom-foto"
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[rgb(var(--primary))]"
            />
          </div>
        )}

        <input ref={entrada} type="file" accept="image/*" className="hidden" onChange={escolher} />
        <button type="button" className="btn-outline w-full" onClick={() => entrada.current?.click()}>
          <Camera size={16} /> {imagem ? 'Escolher outra foto' : 'Escolher uma foto'}
        </button>

        {erro && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary" role="alert">{erro}</p>}

        <div className="flex items-center justify-between gap-2">
          {usuario.fotoUrl ? (
            <button type="button" className="btn-ghost text-primary" disabled={salvando} onClick={remover}>
              <Trash2 size={15} /> Remover foto
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={!previa || salvando} onClick={salvar}>
              {salvando && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
