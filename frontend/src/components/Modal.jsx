import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ titulo, onClose, children, largura = 'max-w-lg' }) {
  useEffect(() => {
    const fechar = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fechar);
    // Impede a página de rolar por trás do modal
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', fechar);
      document.body.style.overflow = antes;
    };
  }, [onClose]);

  // No body: um ancestral com transform (animação da página) prenderia o `fixed` à área de conteúdo
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`card flex max-h-[92vh] w-full animate-slide-up flex-col rounded-b-none shadow-lift sm:animate-scale-in sm:rounded-b-2xl ${largura}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
