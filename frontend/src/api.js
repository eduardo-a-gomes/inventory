/**
 * Cliente HTTP simples para comunicacao com o backend FastAPI.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    throw new Error("Nao foi possivel ligar ao backend. Confirma se o comando 'npm run dev' esta ativo.");
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const detail = errorBody?.detail || "Erro inesperado ao comunicar com o servidor.";
    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const inventarioApi = {
  listarPecas: (q) => {
    const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return request(`/pecas${query}`);
  },

  listarColunas: () => request("/schema/colunas"),

  adicionarColuna: (nome) =>
    request("/schema/colunas", {
      method: "POST",
      body: JSON.stringify({ nome }),
    }),

  renomearColuna: (chave, nome) =>
    request(`/schema/colunas/${encodeURIComponent(chave)}`, {
      method: "PATCH",
      body: JSON.stringify({ nome }),
    }),

  removerColuna: (chave) =>
    request(`/schema/colunas/${encodeURIComponent(chave)}`, {
      method: "DELETE",
    }),

  reordenarColunas: (chaves) =>
    request("/schema/colunas-ordem", {
      method: "PATCH",
      body: JSON.stringify({ chaves }),
    }),

  exportarExcel: async () => {
    const response = await fetch(`${API_BASE_URL}/export/excel`, { method: "GET" });
    if (!response.ok) {
      throw new Error("Nao foi possivel exportar para Excel.");
    }
    const blob = await response.blob();
    return {
      blob,
      filename: response.headers.get("content-disposition") || "",
    };
  },

  criarPeca: (payload) =>
    request("/pecas", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  atualizarPeca: (id, payload) =>
    request(`/pecas/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  atualizarQuantidade: (id, quantidade) =>
    request(`/pecas/${id}/quantidade`, {
      method: "PATCH",
      body: JSON.stringify({ quantidade }),
    }),

  eliminarPeca: (id) =>
    request(`/pecas/${id}`, {
      method: "DELETE",
    }),
};
