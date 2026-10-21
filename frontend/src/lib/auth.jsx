import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, definirAoExpirar, tokenStore } from './api.js';

const AuthContext = createContext(null);

// Token do usuário original enquanto ele "acessa o ambiente" de outro (vale só nesta aba)
const ORIGINAL_KEY = 'procrm.token.original';
const original = {
  get: () => sessionStorage.getItem(ORIGINAL_KEY),
  set: (t) => sessionStorage.setItem(ORIGINAL_KEY, t),
  clear: () => sessionStorage.removeItem(ORIGINAL_KEY),
};

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState(null);
  const [impersonadoPor, setImpersonadoPor] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(tokenStore.get()));

  const sair = useCallback(() => {
    tokenStore.clear();
    original.clear();
    setUsuario(null);
    setImpersonadoPor(null);
    // Evita que o próximo login veja dados em cache do usuário anterior
    qc.clear();
  }, [qc]);

  useEffect(() => {
    definirAoExpirar(sair);
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then((r) => {
        setUsuario(r.usuario);
        setImpersonadoPor(r.impersonadoPor);
      })
      .catch(sair)
      .finally(() => setCarregando(false));
  }, [sair]);

  const concluir = ({ token, usuario: u }) => {
    qc.clear();
    tokenStore.set(token);
    setUsuario(u);
    setImpersonadoPor(null);
  };

  /** Retorna { etapa: 'otp' } quando falta o código; senão já entra. */
  const entrar = async (email, senha) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, senha } });
    if (r.token) concluir(r);
    return r;
  };

  const verificarCodigo = async (email, codigo) => {
    concluir(await api('/auth/verificar-otp', { method: 'POST', body: { email, codigo } }));
  };

  /** Acessa o ambiente de um supervisor, guardando o token atual para poder voltar. */
  const entrarComo = async (usuarioId) => {
    const r = await api('/painel/entrar-como', { method: 'POST', body: { usuarioId } });
    original.set(tokenStore.get());
    qc.clear();
    tokenStore.set(r.token);
    setUsuario(r.usuario);
    setImpersonadoPor({ nome: usuario.nome });
  };

  const voltar = async () => {
    const token = original.get();
    original.clear();
    if (!token) return sair();
    qc.clear();
    tokenStore.set(token);
    try {
      const r = await api('/auth/me');
      setUsuario(r.usuario);
      setImpersonadoPor(null);
    } catch {
      sair();
    }
  };

  return (
    <AuthContext.Provider
      value={{ usuario, impersonadoPor, carregando, entrar, verificarCodigo, entrarComo, voltar, sair }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
