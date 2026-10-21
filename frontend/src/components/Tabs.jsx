import { useLayoutEffect, useRef, useState } from 'react';

/** Abas com um destaque que desliza até a aba ativa. */
export default function Tabs({ abas, ativa, onChange }) {
  const raiz = useRef(null);
  const [marca, setMarca] = useState(null);

  useLayoutEffect(() => {
    const medir = () => {
      const botao = raiz.current?.querySelector('[aria-selected="true"]');
      if (botao) setMarca({ left: botao.offsetLeft, width: botao.offsetWidth });
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [ativa, abas.length]);

  return (
    <div ref={raiz} role="tablist" className="relative mb-5 flex gap-1 overflow-x-auto rounded-xl bg-surface2 p-1">
      {marca && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 top-1 rounded-lg bg-surface shadow-card transition-all duration-300 ease-out"
          style={{ left: marca.left, width: marca.width }}
        />
      )}
      {abas.map((a) => (
        <button
          key={a.valor}
          role="tab"
          aria-selected={ativa === a.valor}
          onClick={() => onChange(a.valor)}
          className={`relative z-10 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            ativa === a.valor ? 'text-primary' : 'text-muted hover:text-fg'
          }`}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}
