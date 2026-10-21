const TOKEN_KEY = 'procrm.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => {
  aoExpirar = fn;
};

export async function api(caminho, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  const resposta = await fetch(`/api${caminho}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    // Token vencido em rota autenticada (login com erro 401 não conta)
    if (resposta.status === 401 && token && !caminho.startsWith('/auth/login')) {
      // Explica na tela de login por que a sessão acabou
      if (['SESSAO_ENCERRADA', 'IP_NAO_PERMITIDO'].includes(json.codigo)) {
        try {
          sessionStorage.setItem('procrm.aviso', json.erro);
        } catch {
          /* sem sessionStorage */
        }
      }
      aoExpirar();
    }
    throw new Error(json.erro || 'Erro ao comunicar com o servidor.');
  }
  return json;
}

/** Envia um arquivo (multipart) para um endpoint autenticado. */
export async function enviarArquivo(caminho, arquivo, campo = 'arquivo') {
  const dados = new FormData();
  dados.append(campo, arquivo);
  const token = tokenStore.get();
  const resposta = await fetch(`/api${caminho}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: dados,
  });
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    if (resposta.status === 401 && token) aoExpirar();
    throw new Error(json.erro || 'Não foi possível enviar o arquivo.');
  }
  return json;
}

/** Baixa um arquivo protegido por login e abre o diálogo de salvar. */
export async function baixarArquivo(caminho, nomeSugerido) {
  const token = tokenStore.get();
  const resposta = await fetch(`/api${caminho}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!resposta.ok) {
    const json = await resposta.json().catch(() => ({}));
    throw new Error(json.erro || 'Não foi possível baixar o arquivo.');
  }
  const url = URL.createObjectURL(await resposta.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeSugerido;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
