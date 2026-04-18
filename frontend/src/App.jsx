import { useEffect, useMemo, useState } from "react";
import { inventarioApi } from "./api";
import ConfirmModal from "./components/ConfirmModal";
import PecasTable from "./components/PecasTable";
import SchemaManagerModal from "./components/SchemaManagerModal";
import ToastStack from "./components/ToastStack";

const PESQUISA_DEBOUNCE_MS = 220;
const QUANTIDADE_INICIAL_NOVO_MATERIAL = 1;

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
 * Pagina principal da aplicacao de inventario.
 */
export default function App() {
  const [pecas, setPecas] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingConfirmacao, setLoadingConfirmacao] = useState(false);
  const [operacaoEmCursoId, setOperacaoEmCursoId] = useState(null);
  const [pesquisa, setPesquisa] = useState("");
  const [filtroAtual, setFiltroAtual] = useState("");
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: "asc" });
  const [modalSchemaAberto, setModalSchemaAberto] = useState(false);
  const [tokenNovoMaterial, setTokenNovoMaterial] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [confirmacao, setConfirmacao] = useState(null);

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
  }, []);

  useEffect(() => {
    if (!ordenacao.campo || !colunas.length) {
      return;
    }

    const colunaExiste = colunas.some((coluna) => coluna.chave === ordenacao.campo);
    if (!colunaExiste) {
      setOrdenacao({ campo: null, direcao: "asc" });
    }
  }, [colunas, ordenacao.campo]);

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
            titulo: "Referencia duplicada",
            mensagem: `Ja existe um registo com a referencia "${payload.referencia}". Quer mesmo submeter?`,
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
      mostrarToast("sucesso", "Nova peca adicionada ao inventario.");
      await carregarPecas(filtroAtual);
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
      await carregarPecas(filtroAtual);
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
      await carregarPecas(filtroAtual);
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
        mensagem: "Tem a certeza que quer eliminar este registo?",
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
      await carregarPecas(filtroAtual);
    } catch (error) {
      mostrarToast("erro", error.message);
    } finally {
      setOperacaoEmCursoId(null);
    }
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
      mostrarToast("aviso", "Essa coluna e fixa e nao pode ser eliminada.");
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
                  coluna.chave === "preco" ? `${Number(valor ?? 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : valor;
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
              <title>Impressao Inventario</title>
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
              <h1>Inventario Oficina AutoCardoso</h1>
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
        mostrarToast("erro", error.message || "Erro ao preparar impressao.");
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
      mostrarToast("sucesso", "Exportacao em Excel concluida.");
    } catch (error) {
      mostrarToast("erro", error.message);
    }
  };

  return (
    <main className="app">
      <header className="cabecalho">
        <div className="cabecalho-topo">
          <div className="brand">
            <img src="/AutoCardoso.png" alt="Logo da oficina AutoCardoso" />
            <div>
              <h1>Inventário</h1>
            </div>
          </div>

          <div className="acoes-topo">
            <button type="button" className="botao-iconico" onClick={handleImprimir} title="Imprimir tabela da base de dados">
              <IconeImprimir />
            </button>
            <button type="button" className="botao-iconico" onClick={handleExportarExcel} title="Exportar base de dados para Excel">
              <IconeExportar />
            </button>
          </div>
        </div>

        <form className="pesquisa" onSubmit={handlePesquisar}>
          <input
            type="search"
            placeholder="Pesquisar por referencia, marca, designacao..."
            value={pesquisa}
            onChange={(event) => setPesquisa(event.target.value)}
          />
          <button type="submit">Pesquisar</button>
          <button type="button" className="botao-secundario" onClick={() => setModalSchemaAberto(true)}>
            Gerir colunas
          </button>
        </form>

        <div className="acoes-pesquisa-inferior">
          <button
            type="button"
            className="botao-novo-material"
            onClick={() => setTokenNovoMaterial((anterior) => anterior + 1)}
            title="Adicionar novo material ao inventario"
          >
            <IconeMais />
            <span>Novo material</span>
          </button>
        </div>
      </header>

      <section className="layout-principal">
        <PecasTable
          pecas={pecasOrdenadas}
          colunas={colunas}
          loading={loadingLista}
          onGuardarEdicao={handleGuardarEdicaoInline}
          onEliminar={handleEliminar}
          onAlterarQuantidade={handleAlterarQuantidade}
          operacaoEmCursoId={operacaoEmCursoId}
          ordenacao={ordenacao}
          onOrdenar={handleOrdenar}
          tokenNovoMaterial={tokenNovoMaterial}
          loadingCriacao={loadingForm}
          onCriarNovo={handleCriarNovoInline}
        />
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

      <ToastStack itens={toasts} onFechar={removerToast} />
    </main>
  );
}
