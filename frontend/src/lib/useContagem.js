import { useEffect, useState } from 'react';

const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Anima um número de 0 até `alvo` (ease-out). Quem prefere menos movimento recebe o valor final. */
export function useContagem(alvo, duracao = 900) {
  const [valor, setValor] = useState(prefereMenosMovimento() ? alvo : 0);

  useEffect(() => {
    if (prefereMenosMovimento() || !Number.isFinite(alvo)) {
      setValor(alvo);
      return undefined;
    }
    let quadro;
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      setValor(alvo * (1 - (1 - t) ** 3));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, duracao]);

  return valor;
}
