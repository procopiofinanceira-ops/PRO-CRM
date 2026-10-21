import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const CHAVE = 'procrm.tema';

function temaInicial() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
    /* localStorage indisponível */
  }
  // Primeira visita: tema escuro, que é a identidade visual do sistema
  return 'escuro';
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      /* ignora */
    }
  }, [tema]);

  const alternar = () => setTema((t) => (t === 'escuro' ? 'claro' : 'escuro'));

  return <ThemeContext.Provider value={{ tema, alternar }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
