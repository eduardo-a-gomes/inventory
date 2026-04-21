/**
 * Cliente HTTP simples para comunicação com o backend FastAPI.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const NOMES_CAMPOS_ERRO = {
  referencia: "Referência",
  categoria: "Categoria",
  marca: "Marca",
  designacao: "Designação",
  preco: "Preço",
  quantidade: "Quantidade",
  local: "Local",
  extras: "Campos extra",
};

function formatarCampoErro(loc) {
  if (!Array.isArray(loc)) {
    return "";
  }

  return loc
    .map((parte) => String(parte ?? ""))
    .filter((parte) => parte && parte !== "body")
    .map((parte) => NOMES_CAMPOS_ERRO[parte] || parte)
    .join(" > ");
}

function limparMensagemValidacao(mensagem) {
  return String(mensagem || "")
    .trim()
    .replace(/^Value error,\s*/i, "");
}

function traduzirMensagemErro(item) {
  if (!item || typeof item !== "object") {
    return limparMensagemValidacao(item);
  }

  switch (item.type) {
    case "missing":
      return "Campo obrigatório.";
    case "string_too_long":
      return item.ctx?.max_length
        ? `Texto demasiado longo. Limite: ${item.ctx.max_length} caracteres.`
        : "Texto demasiado longo.";
    case "string_too_short":
      return "Texto demasiado curto.";
    case "greater_than_equal":
      return item.ctx?.ge !== undefined ? `Tem de ser maior ou igual a ${item.ctx.ge}.` : "Valor demasiado baixo.";
    case "int_parsing":
    case "int_type":
      return "Tem de ser um número inteiro.";
    case "value_error":
      return limparMensagemValidacao(item.msg || item.message || "Dados inválidos.");
    default:
      return limparMensagemValidacao(item.msg || item.message || JSON.stringify(item));
  }
}

function formatarDetalheErro(detail) {
  if (!detail) {
    return "Erro inesperado ao comunicar com o servidor.";
  }

  if (typeof detail === "string") {
    return limparMensagemValidacao(detail);
  }

  if (Array.isArray(detail)) {
    const mensagens = detail
      .map((item) => {
        if (typeof item === "string") {
          return limparMensagemValidacao(item);
        }

        const campo = formatarCampoErro(item?.loc);
        const mensagem = traduzirMensagemErro(item);
        return campo ? `${campo}: ${mensagem}` : mensagem;
      })
      .filter(Boolean);

    return mensagens.join(" ") || "Dados inválidos. Confirma os campos preenchidos.";
  }

  if (typeof detail === "object") {
    return limparMensagemValidacao(detail.msg || detail.message || JSON.stringify(detail));
  }

  return String(detail);
}

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
    throw new Error("Não foi possível ligar ao servidor da aplicação. Fecha e volta a abrir o inventário.");
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const detail = formatarDetalheErro(errorBody?.detail);
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

  listarVendas: () => request("/vendas"),

  atualizarVendaHistorico: (id, payload) =>
    request(`/vendas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  eliminarVendaHistorico: (id) =>
    request(`/vendas/${id}`, {
      method: "DELETE",
    }),

  reporVendaNoInventario: (id) =>
    request(`/vendas/${id}/repor`, {
      method: "POST",
    }),

  obterDashboardVendas: () => request("/dashboard/vendas"),

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
      throw new Error("Não foi possível exportar para Excel.");
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

  registarVenda: (id, payload) =>
    request(`/pecas/${id}/venda`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  eliminarPeca: (id) =>
    request(`/pecas/${id}`, {
      method: "DELETE",
    }),
};

