import { useEffect, useMemo, useRef, useState } from "react";
import { inventarioApi } from "./api";
import ConfirmModal from "./components/ConfirmModal";
import DashboardVendas from "./components/DashboardVendas";
import PecasTable from "./components/PecasTable";
import SchemaManagerModal from "./components/SchemaManagerModal";
import ToastStack from "./components/ToastStack";
import VendaModal from "./components/VendaModal";

const PESQUISA_DEBOUNCE_MS = 220;
const QUANTIDADE_INICIAL_NOVO_MATERIAL = 1;
const STORAGE_KEY_TEMA_FUNDO = "inventario-tema-fundo";
const TEMAS_FUNDO = [
  { id: "atual", nome: "Original" },
  { id: "image-poster", nome: "Escort poster" },
];

function IconeImprimir() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 8V4h10v4" />
      <path d="M6 17H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <path d="M7 14h10v6H7z" />
    </svg>
  );
}

function IconeExportar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 21h16" />
    </svg>
  );
}

function IconeMais() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconeFundos() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path d="M3 16.5l9 4.5 9-4.5" />
    </svg>
  );
}

function IconeLupa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function obterValorColuna(peca, campo) {
  if (Object.prototype.hasOwnProperty.call(peca, campo)) {
    return peca[campo];
  }
  return peca.extras?.[campo];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function temConteudoParaCriar(payload) {
  const textosComConteudo = [
    payload?.referencia,
    payload?.categoria,
    payload?.marca,
    payload?.designacao,
    payload?.local,
  ].some((valor) => String(valor ?? "").trim() !== "");

  const precoComConteudo = Number(payload?.preco ?? 0) > 0;
  const quantidadeComConteudo =
    Number(payload?.quantidade ?? QUANTIDADE_INICIAL_NOVO_MATERIAL) !== QUANTIDADE_INICIAL_NOVO_MATERIAL;

  const extrasComConteudo = Object.values(payload?.extras || {}).some((valor) => String(valor ?? "").trim() !== "");

  return textosComConteudo || precoComConteudo || quantidadeComConteudo || extrasComConteudo;
}

function normalizarReferencia(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

/**
 * Página principal da aplicação de inventário.
 */
export default function App() {
  const [pecas, setPecas] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingConfirmacao, setLoadingConfirmacao] = useState(false);
  const [operacaoEmCursoId, setOperacaoEmCursoId] = useState(null);
  const [operacaoVendaHistoricoId, setOperacaoVendaHistoricoId] = useState(null);
  const [pesquisa, setPesquisa] = useState("");
  const [filtroAtual, setFiltroAtual] = useState("");
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: "asc" });
  const [modalSchemaAberto, setModalSchemaAberto] = useState(false);
  const [tokenNovoMaterial, setTokenNovoMaterial] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [confirmacao, setConfirmacao] = useState(null);
  const [vendaModal, setVendaModal] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [vistaAtiva, setVistaAtiva] = useState("inventario");
  const [temaFundo, setTemaFundo] = useState(() => {
    if (typeof window === "undefined") {
      return "atual";
    }

    const temaGuardado = window.localStorage.getItem(STORAGE_KEY_TEMA_FUNDO);
    return TEMAS_FUNDO.some((tema) => tema.id === temaGuardado) ? temaGuardado : "atual";
  });
  const [seletorFundosAberto, setSeletorFundosAberto] = useState(false);
  const seletorFundosRef = useRef(null);
  const temaFundoInicializadoRef = useRef(false);

  const mostrarToast = (tipo, mensagem) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((anterior) => [...anterior, { id, tipo, mensagem }]);

    setTimeout(() => {
      setToasts((anterior) => anterior.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const removerToast = (id) => {
    setToasts((anterior) => anterior.filter((toast) => toast.id !== id));
  };

  const pecasOrdenadas = useMemo(() => {
    if (!ordenacao.campo) {
      return pecas;
    }

    const lista = [...pecas];
    lista.sort((a, b) => {
      const valorA = obterValorColuna(a, ordenacao.campo);
      const valorB = obterValorColuna(b, ordenacao.campo);

      if (ordenacao.campo === "quantidade" || (typeof valorA === "number" && typeof valorB === "number")) {
        const numeroA = Number(valorA ?? 0);
        const numeroB = Number(valorB ?? 0);
        return ordenacao.direcao === "asc" ? numeroA - numeroB : numeroB - numeroA;
      }

      const textoA = String(valorA ?? "").toLowerCase();
      const textoB = String(valorB ?? "").toLowerCase();
      const comparacao = textoA.localeCompare(textoB, "pt");
      return ordenacao.direcao === "asc" ? comparacao : comparacao * -1;
    });

    return lista;
  }, [pecas, ordenacao]);

  const carregarPecas = async (termo = "") => {
    setLoadingLista(true);
    try {
      const data = await inventarioApi.listarPecas(termo);
      setPecas(data);
      setFiltroAtual(termo);
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setLoadingLista(false);
    }
  };

  const carregarDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const data = await inventarioApi.obterDashboardVendas();
      setDashboard(data);
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const sincronizarInventarioEDashboard = async (termo = filtroAtual) => {
    await Promise.all([carregarPecas(termo), carregarDashboard()]);
  };

  const carregarColunas = async () => {
    try {
      const data = await inventarioApi.listarColunas();
      setColunas(data);
      return data;
    } catch (error) {
      mostrarToast("erro", error.message);
      return [];
    }
  };

  useEffect(() => {
    carregarPecas();
    carregarColunas();
    carregarDashboard();
  }, []);

  useEffect(() => {
    let ativo = true;

    const carregarTemaFundo = async () => {
      try {
        const preferencia = await inventarioApi.obterTemaFundo();
        if (!ativo) {
          return;
        }

        const temaServidor = preferencia?.tema;
        if (TEMAS_FUNDO.some((tema) => tema.id === temaServidor)) {
          setTemaFundo(temaServidor);
        }
      } catch (error) {
        mostrarToast("erro", error.message);
      } finally {
        if (ativo) {
          temaFundoInicializadoRef.current = true;
        }
      }
    };

    carregarTemaFundo();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const classesTemas = TEMAS_FUNDO.map((tema) => `tema-fundo-${tema.id}`);
    document.body.classList.remove(...classesTemas);
    document.body.classList.add(`tema-fundo-${temaFundo}`);
    window.localStorage.setItem(STORAGE_KEY_TEMA_FUNDO, temaFundo);
  }, [temaFundo]);

  useEffect(() => {
    if (!temaFundoInicializadoRef.current) {
      return;
    }

    inventarioApi.guardarTemaFundo(temaFundo).catch((error) => {
      mostrarToast("erro", error.message);
    });
  }, [temaFundo]);

  useEffect(() => {
    if (!seletorFundosAberto) {
      return undefined;
    }

    const fecharAoClicarFora = (event) => {
      if (seletorFundosRef.current?.contains(event.target)) {
        return;
      }
      setSeletorFundosAberto(false);
    };

    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora);
    };
  }, [seletorFundosAberto]);

  useEffect(() => {
    if (!ordenacao.campo || !colunas.length) {
      return;
    }

    const colunaExiste = colunas.some((coluna) => coluna.chave === ordenacao.campo);
    if (!colunaExiste) {
      setOrdenacao({ campo: null, direcao: "asc" });
    }
  }, [colunas, ordenacao.campo]);

  useEffect(() => {
    if (vistaAtiva !== "dashboard") {
      return;
    }
    carregarDashboard();
  }, [vistaAtiva]);

  const abrirConfirmacao = ({
    titulo,
    mensagem,
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar",
    perigo = false,
    onConfirm,
    onCancel,
  }) => {
    setConfirmacao({
      titulo,
      mensagem,
      textoConfirmar,
      textoCancelar,
      perigo,
      onConfirm,
      onCancel,
    });
  };

  const fecharConfirmacao = () => {
    if (loadingConfirmacao) {
      return;
    }
    confirmacao?.onCancel?.();
    setConfirmacao(null);
  };

  const confirmarAcao = async () => {
    if (!confirmacao?.onConfirm) {
      return;
    }

    setLoadingConfirmacao(true);
    try {
      await confirmacao.onConfirm();
      setConfirmacao(null);
    } finally {
      setLoadingConfirmacao(false);
    }
  };

  const handleCriarNovoInline = async (payload) => {
    if (!temConteudoParaCriar(payload)) {
      mostrarToast("aviso", "Preenche pelo menos um campo antes de adicionar.");
      return false;
    }

    const referenciaNormalizada = normalizarReferencia(payload?.referencia);
    if (referenciaNormalizada) {
      let pecasParaValidar = pecas;
      try {
        pecasParaValidar = await inventarioApi.listarPecas("");
      } catch {
        // Se a validacao completa falhar, seguimos com a lista atual carregada.
      }

      const referenciaDuplicada = pecasParaValidar.some(
        (pecaExistente) => normalizarReferencia(pecaExistente.referencia) === referenciaNormalizada,
      );

      if (referenciaDuplicada) {
        const confirmarCriacao = await new Promise((resolve) => {
          abrirConfirmacao({
            titulo: "Referência duplicada",
            mensagem: `Já existe um registo com a referência "${payload.referencia}". Quer mesmo submeter?`,
            textoConfirmar: "Submeter",
            textoCancelar: "Cancelar",
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });

        if (!confirmarCriacao) {
          return false;
        }
      }
    }

    setLoadingForm(true);
    try {
      await inventarioApi.criarPeca(payload);
      mostrarToast("sucesso", "Nova peça adicionada ao inventário.");
      await sincronizarInventarioEDashboard(filtroAtual);
      return true;
    } catch (error) {
      const mensagem = String(error?.message || "Erro ao adicionar material.");
      if (mensagem.toLowerCase().includes("preencha pelo menos um campo")) {
        mostrarToast("aviso", mensagem);
        return false;
      }
      mostrarToast("erro", mensagem);
      return false;
    } finally {
      setLoadingForm(false);
    }
  };

  const handleGuardarEdicaoInline = async (peca, payload) => {
    setOperacaoEmCursoId(peca.id);
    try {
      await inventarioApi.atualizarPeca(peca.id, payload);
      mostrarToast("sucesso", "Material atualizado.");
      await sincronizarInventarioEDashboard(filtroAtual);
      return true;
    } catch (error) {
      mostrarToast("erro", error.message);
      return false;
    } finally {
      setOperacaoEmCursoId(null);
    }
  };

  const eliminarPeca = async (peca) => {
    setOperacaoEmCursoId(peca.id);
    try {
      await inventarioApi.eliminarPeca(peca.id);
      mostrarToast("sucesso", "Material eliminado com sucesso.");
      await sincronizarInventarioEDashboard(filtroAtual);
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setOperacaoEmCursoId(null);
    }
  };

  const handleEliminar = (peca) => {
    abrirConfirmacao({
      titulo: "Eliminar material",
      mensagem: `Pretende eliminar "${peca.designacao}"?`,
      textoConfirmar: "Eliminar",
      perigo: true,
      onConfirm: () => eliminarPeca(peca),
    });
  };

  const handleAlterarQuantidade = async (peca, quantidade) => {
    const quantidadeAnterior = Number(peca.quantidade ?? 0);
    const novaQuantidade = Number(quantidade ?? 0);
    let mensagemSucesso = "Quantidade atualizada.";

    if (novaQuantidade > quantidadeAnterior) {
      mensagemSucesso = "Quantidade aumentada.";
    } else if (novaQuantidade < quantidadeAnterior) {
      mensagemSucesso = "Quantidade reduzida.";
    }

    if (quantidadeAnterior > 0 && novaQuantidade === 0) {
      abrirConfirmacao({
        titulo: "Eliminar registo",
        mensagem: "Ao reduzir para zero, este material será removido do inventário. Pretende continuar?",
        textoConfirmar: "Eliminar",
        perigo: true,
        onConfirm: () => eliminarPeca(peca),
      });
      return;
    }

    setOperacaoEmCursoId(peca.id);
    try {
      await inventarioApi.atualizarQuantidade(peca.id, quantidade);
      mostrarToast("sucesso", mensagemSucesso);
      await sincronizarInventarioEDashboard(filtroAtual);
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setOperacaoEmCursoId(null);
    }
  };

  const abrirVendaModal = (peca) => {
    setVendaModal({ peca });
  };

  const fecharVendaModal = () => {
    if (operacaoEmCursoId) {
      return;
    }
    setVendaModal(null);
  };

  const confirmarVenda = async (payload) => {
    if (!vendaModal?.peca) {
      return;
    }

    const peca = vendaModal.peca;
    const quantidadeVendida = Math.max(1, Number(payload?.quantidade ?? 1));
    const quantidadeAtual = Number(peca.quantidade ?? 0);
    const quantidadeFinal = Math.max(0, quantidadeAtual - quantidadeVendida);

    setOperacaoEmCursoId(peca.id);
    try {
      await inventarioApi.registarVenda(peca.id, payload);
      const mensagemSucesso =
        quantidadeFinal === 0
          ? "Venda registada. Material esgotado e removido do inventário."
          : "Venda registada com sucesso.";
      mostrarToast("sucesso", mensagemSucesso);
      setVendaModal(null);
      await sincronizarInventarioEDashboard(filtroAtual);
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setOperacaoEmCursoId(null);
    }
  };

  const handleAtualizarVendaHistorico = async (venda, payload) => {
    if (!venda?.id) {
      return false;
    }

    setOperacaoVendaHistoricoId(venda.id);
    try {
      await inventarioApi.atualizarVendaHistorico(venda.id, payload);
      mostrarToast("sucesso", "Registo de venda atualizado.");
      await sincronizarInventarioEDashboard(filtroAtual);
      return true;
    } catch (error) {
      mostrarToast("erro", error.message);
      return false;
    } finally {
      setOperacaoVendaHistoricoId(null);
    }
  };

  const handleEliminarVendaHistorico = (venda) => {
    abrirConfirmacao({
      titulo: "Eliminar registo de venda",
      mensagem: `Pretende eliminar o registo de venda de "${venda?.designacao || "material"}"?`,
      textoConfirmar: "Eliminar",
      perigo: true,
      onConfirm: async () => {
        setOperacaoVendaHistoricoId(venda.id);
        try {
          await inventarioApi.eliminarVendaHistorico(venda.id);
          mostrarToast("sucesso", "Registo de venda eliminado.");
          await sincronizarInventarioEDashboard(filtroAtual);
        } catch (error) {
          mostrarToast("erro", error.message);
        } finally {
          setOperacaoVendaHistoricoId(null);
        }
      },
    });
  };

  const handleReporVendaHistorico = (venda) => {
    abrirConfirmacao({
      titulo: "Repor venda no inventário",
      mensagem: `Pretende repor ${venda?.quantidade_vendida || 0} unidade(s) de "${venda?.designacao || "material"}" no inventário?`,
      textoConfirmar: "Repor",
      perigo: false,
      onConfirm: async () => {
        setOperacaoVendaHistoricoId(venda.id);
        try {
          await inventarioApi.reporVendaNoInventario(venda.id);
          mostrarToast("sucesso", "Venda reposta no inventário.");
          await sincronizarInventarioEDashboard(filtroAtual);
        } catch (error) {
          mostrarToast("erro", error.message);
        } finally {
          setOperacaoVendaHistoricoId(null);
        }
      },
    });
  };

  const handlePesquisar = async (event) => {
    event.preventDefault();
    await carregarPecas(pesquisa.trim());
  };

  useEffect(() => {
    const termo = pesquisa.trim();
    if (termo === filtroAtual) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      carregarPecas(termo);
    }, PESQUISA_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pesquisa, filtroAtual]);

  const handleOrdenar = (campo) => {
    setOrdenacao((anterior) => {
      if (anterior.campo === campo) {
        return {
          campo,
          direcao: anterior.direcao === "asc" ? "desc" : "asc",
        };
      }

      return {
        campo,
        direcao: "asc",
      };
    });
  };

  const handleAdicionarColuna = async (nome) => {
    setLoadingSchema(true);
    try {
      await inventarioApi.adicionarColuna(nome);
      mostrarToast("sucesso", `Coluna "${nome}" adicionada.`);
      await Promise.all([carregarColunas(), carregarPecas(filtroAtual)]);
      return true;
    } catch (error) {
      mostrarToast("erro", error.message);
      return false;
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleRemoverColuna = (coluna) => {
    if (coluna?.chave === "quantidade" || coluna?.chave === "preco") {
      mostrarToast("aviso", "Essa coluna é fixa e não pode ser eliminada.");
      return;
    }

    abrirConfirmacao({
      titulo: "Eliminar coluna",
      mensagem: `Pretende eliminar a coluna "${coluna.nome}"?`,
      textoConfirmar: "Eliminar",
      perigo: true,
      onConfirm: async () => {
        setLoadingSchema(true);
        try {
          await inventarioApi.removerColuna(coluna.chave);
          mostrarToast("sucesso", `Coluna "${coluna.nome}" removida.`);
          await Promise.all([carregarColunas(), carregarPecas(filtroAtual)]);
        } catch (error) {
          mostrarToast("erro", error.message);
        } finally {
          setLoadingSchema(false);
        }
      },
    });
  };

  const handleRenomearColuna = async (coluna, novoNome) => {
    setLoadingSchema(true);
    try {
      await inventarioApi.renomearColuna(coluna.chave, novoNome);
      mostrarToast("sucesso", `Coluna "${coluna.nome}" renomeada para "${novoNome}".`);
      await Promise.all([carregarColunas(), carregarPecas(filtroAtual)]);
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleReordenarColunas = async (chaves) => {
    setLoadingSchema(true);
    try {
      await inventarioApi.reordenarColunas(chaves);
      mostrarToast("sucesso", "Ordem das colunas atualizada.");
      await carregarColunas();
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleImprimir = () => {
    (async () => {
      try {
        const [colunasPrint, pecasPrint] = await Promise.all([inventarioApi.listarColunas(), inventarioApi.listarPecas("")]);

        const headers = colunasPrint.map((coluna) => `<th>${escapeHtml(coluna.nome)}</th>`).join("");
        const rows = pecasPrint
          .map((peca) => {
            const cols = colunasPrint
              .map((coluna) => {
                const valor = obterValorColuna(peca, coluna.chave);
                const valorFormatado =
                  coluna.chave === "preco" ? `${Number(valor ?? 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR` : valor;
                return `<td>${escapeHtml(valorFormatado ?? "-")}</td>`;
              })
              .join("");
            return `<tr>${cols}</tr>`;
          })
          .join("");

        const html = `
          <!doctype html>
          <html lang="pt-PT">
            <head>
              <meta charset="UTF-8" />
              <title>Impressão Inventário</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
                h1 { margin: 0 0 10px; font-size: 22px; }
                p { margin: 0 0 16px; color: #444; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #999; padding: 8px; text-align: left; font-size: 12px; }
                th { background: #ececec; }
              </style>
            </head>
            <body>
              <h1>Inventário Oficina AutoCardoso</h1>
              <p>Data: ${new Date().toLocaleString("pt-PT")}</p>
              <table>
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </body>
          </html>
        `;

        const janela = window.open("", "_blank", "width=1100,height=780");
        if (!janela) {
          mostrarToast("erro", "Bloqueio de popup ativo. Permite popups para imprimir.");
          return;
        }
        janela.document.open();
        janela.document.write(html);
        janela.document.close();
        janela.focus();
        setTimeout(() => {
          janela.print();
        }, 250);
      } catch (error) {
        mostrarToast("erro", error.message || "Erro ao preparar impressão.");
      }
    })();
  };

  const handleExportarExcel = async () => {
    try {
      const { blob, filename } = await inventarioApi.exportarExcel();
      const match = /filename="?([^"]+)"?/i.exec(filename || "");
      const nomeFinal = match?.[1] || `inventario_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeFinal;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      mostrarToast("sucesso", "Exportação em Excel concluída.");
    } catch (error) {
      mostrarToast("erro", error.message);
    }
  };

  return (
    <main className="app">
      <header className="cabecalho">
        <div className="cabecalho-topo">
          <div className="brand" style={{ transform: "scale(1.80)", transformOrigin: "left center" }}>
            <img src="/AutoCardoso.png" alt="Logo da oficina AutoCardoso" />
          </div>
          <div className="barra-superior">
            <div className="nav-vistas" style={{ gap: "20px", marginLeft: "80px" }}>
              <button
                type="button"
                className={`botao-vista${vistaAtiva === "inventario" ? " ativa" : ""}`}
                onClick={() => setVistaAtiva("inventario")}
                style={{ fontSize: "18px", padding: "10px 20px" }}
              >
                Inventário
              </button>
              <button
                type="button"
                className={`botao-vista${vistaAtiva === "dashboard" ? " ativa" : ""}`}
                onClick={() => {
                  setVistaAtiva("dashboard");
                  carregarDashboard();
                }}
                style={{ fontSize: "18px", padding: "10px 20px" }}
              >
                Dashboard
              </button>
            </div>

            <div className="acoes-topo">
              <div className="fundo-picker" ref={seletorFundosRef}>
                <button
                  type="button"
                  className="botao-iconico botao-fundos-toggle"
                  title="Escolher fundo"
                  onClick={() => setSeletorFundosAberto((anterior) => !anterior)}
                >
                  <IconeFundos />
                </button>

                {seletorFundosAberto ? (
                  <div className="menu-fundos">
                    <p>Fundos</p>
                    <div className="lista-fundos">
                      {TEMAS_FUNDO.map((tema) => (
                        <button
                          key={tema.id}
                          type="button"
                          className={`botao-fundo-opcao${temaFundo === tema.id ? " ativa" : ""}`}
                          onClick={() => {
                            setTemaFundo(tema.id);
                            setSeletorFundosAberto(false);
                          }}
                        >
                          <span className={`swatch-fundo swatch-fundo-${tema.id}`} aria-hidden="true" />
                          <span>{tema.nome}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <button type="button" className="botao-iconico" onClick={handleImprimir} title="Imprimir tabela da base de dados">
                <IconeImprimir />
              </button>
              <button type="button" className="botao-iconico" onClick={handleExportarExcel} title="Exportar base de dados para Excel">
                <IconeExportar />
              </button>
            </div>
          </div>
        </div>
        {vistaAtiva === "inventario" ? (
          <>
            <form className="pesquisa" onSubmit={handlePesquisar} style={{ display: "flex", width: "100%", gap: "12px" }}>
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <input
                  type="search"
                  placeholder="Pesquisar por referência, marca, designação..."
                  value={pesquisa}
                  onChange={(event) => setPesquisa(event.target.value)}
                  style={{ width: "100%", paddingRight: "145px" }}
                />
                <button 
                  type="submit" 
                  style={{ 
                    position: "absolute", 
                    right: "0px", 
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: "calc(100% - 12px)", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "6px",
                    padding: "0 16px",
                    margin: 0,
                    color: "#fff"
                  }}
                >
                  <IconeLupa /> Pesquisar
                </button>
              </div>
              <button type="button" className="botao-secundario" onClick={() => setModalSchemaAberto(true)} style={{ whiteSpace: "nowrap" }}>
                Gerir colunas
              </button>
              <button
                type="button"
                className="botao-novo-material"
                onClick={() => setTokenNovoMaterial((anterior) => anterior + 1)}
                title="Adicionar novo material ao inventário"
                style={{ whiteSpace: "nowrap",color: "#fff" }}
              >
                <IconeMais />
                <span>Novo material</span>
              </button>
            </form>
          </>
        ) : null}
      </header>

      <section className="layout-principal">
        {vistaAtiva === "inventario" ? (
          <PecasTable
            pecas={pecasOrdenadas}
            colunas={colunas}
            loading={loadingLista}
            onGuardarEdicao={handleGuardarEdicaoInline}
            onEliminar={handleEliminar}
            onAlterarQuantidade={handleAlterarQuantidade}
            onAbrirVenda={abrirVendaModal}
            operacaoEmCursoId={operacaoEmCursoId}
            ordenacao={ordenacao}
            onOrdenar={handleOrdenar}
            tokenNovoMaterial={tokenNovoMaterial}
            loadingCriacao={loadingForm}
            onCriarNovo={handleCriarNovoInline}
          />
        ) : (
          <DashboardVendas
            dashboard={dashboard}
            colunas={colunas}
            loading={loadingDashboard}
            operacaoVendaHistoricoId={operacaoVendaHistoricoId}
            onAtualizarVendaHistorico={handleAtualizarVendaHistorico}
            onEliminarVendaHistorico={handleEliminarVendaHistorico}
          />
        )}
      </section>

      <SchemaManagerModal
        aberto={modalSchemaAberto}
        colunas={colunas}
        loading={loadingSchema}
        onFechar={() => setModalSchemaAberto(false)}
        onAdicionar={handleAdicionarColuna}
        onRenomear={handleRenomearColuna}
        onRemover={handleRemoverColuna}
        onReordenar={handleReordenarColunas}
      />

      <ConfirmModal
        aberto={Boolean(confirmacao)}
        titulo={confirmacao?.titulo}
        mensagem={confirmacao?.mensagem}
        textoConfirmar={confirmacao?.textoConfirmar}
        textoCancelar={confirmacao?.textoCancelar}
        perigo={confirmacao?.perigo}
        loading={loadingConfirmacao}
        onConfirm={confirmarAcao}
        onCancel={fecharConfirmacao}
      />

      <VendaModal
        aberto={Boolean(vendaModal)}
        peca={vendaModal?.peca}
        loading={Boolean(vendaModal?.peca && operacaoEmCursoId === vendaModal.peca.id)}
        onConfirm={confirmarVenda}
        onCancel={fecharVendaModal}
      />

      <ToastStack itens={toasts} onFechar={removerToast} />
    </main>
  );
}


