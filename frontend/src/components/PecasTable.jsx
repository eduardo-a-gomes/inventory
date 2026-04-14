import { useEffect, useRef, useState } from "react";

/**
 * Tabela principal de pecas do inventario.
 */
const COLUNAS_PADRAO = [
  { chave: "referencia", nome: "Referencia" },
  { chave: "categoria", nome: "Categoria" },
  { chave: "marca", nome: "Marca" },
  { chave: "designacao", nome: "Designacao" },
  { chave: "local", nome: "Local" },
  { chave: "quantidade", nome: "Quantidade" },
];
const CHAVES_BASE = new Set(["referencia", "categoria", "marca", "designacao", "quantidade", "local"]);

function IconeOrdenacao({ ativo, direcao }) {
  if (!ativo) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7l4-4 4 4M12 3v18M16 17l-4 4-4-4" />
      </svg>
    );
  }

  if (direcao === "asc") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4l-5 6h10l-5-6zM12 10v10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20l5-6H7l5 6zM12 4v10" />
    </svg>
  );
}

function IconeEditar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function IconeEliminar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function IconeGuardar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconeCancelar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function obterValorColuna(peca, chave) {
  if (Object.prototype.hasOwnProperty.call(peca, chave)) {
    return peca[chave];
  }
  return peca.extras?.[chave];
}

function criarDraftVazio(colunasVisiveis) {
  const draft = {
    referencia: "",
    categoria: "",
    marca: "",
    designacao: "",
    quantidade: 0,
    local: "",
  };

  for (const coluna of colunasVisiveis) {
    if (coluna.chave === "quantidade") {
      draft[coluna.chave] = 0;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(draft, coluna.chave)) {
      draft[coluna.chave] = "";
    }
  }
  return draft;
}

export default function PecasTable({
  pecas,
  colunas,
  loading,
  onGuardarEdicao,
  onEliminar,
  onAlterarQuantidade,
  operacaoEmCursoId,
  ordenacao,
  onOrdenar,
  tokenNovoMaterial = 0,
  loadingCriacao = false,
  onCriarNovo,
}) {
  const colunasVisiveis = colunas.length ? colunas : COLUNAS_PADRAO;
  const totalColunas = colunasVisiveis.length + 1; // +1 da coluna de acoes.
  const classeDensidade = totalColunas >= 14 ? "tabela-ultra-compacta" : totalColunas >= 10 ? "tabela-compacta" : "";
  const tabelaRef = useRef(null);
  const [editandoId, setEditandoId] = useState(null);
  const [draft, setDraft] = useState({});
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [draftNovo, setDraftNovo] = useState(() => criarDraftVazio(colunasVisiveis));

  useEffect(() => {
    if (!editandoId) {
      return;
    }
    const existe = pecas.some((peca) => peca.id === editandoId);
    if (!existe) {
      setEditandoId(null);
      setDraft({});
    }
  }, [pecas, editandoId]);

  useEffect(() => {
    if (!tokenNovoMaterial) {
      return;
    }

    setEditandoId(null);
    setDraft({});
    setCriandoNovo(true);
    setDraftNovo(criarDraftVazio(colunasVisiveis));
  }, [tokenNovoMaterial, colunasVisiveis]);

  const draftNovoTemConteudo = () =>
    colunasVisiveis.some((coluna) => {
      const valor = draftNovo[coluna.chave];
      if (coluna.chave === "quantidade") {
        return Number(valor ?? 0) > 0;
      }
      return String(valor ?? "").trim() !== "";
    });

  useEffect(() => {
    if (!criandoNovo) {
      return;
    }

    const handleCliqueFora = (event) => {
      if (loadingCriacao) {
        return;
      }
      if (tabelaRef.current?.contains(event.target)) {
        return;
      }
      if (draftNovoTemConteudo()) {
        void guardarNovo();
      } else {
        cancelarNovo();
      }
    };

    document.addEventListener("mousedown", handleCliqueFora);
    return () => {
      document.removeEventListener("mousedown", handleCliqueFora);
    };
  }, [criandoNovo, draftNovo, loadingCriacao, colunasVisiveis]);

  const montarPayload = (origem) => {
    const extras = {};
    for (const coluna of colunasVisiveis) {
      if (CHAVES_BASE.has(coluna.chave)) {
        continue;
      }
      const valorExtra = String(origem[coluna.chave] ?? "").trim();
      extras[coluna.chave] = valorExtra || null;
    }

    return {
      referencia: String(origem.referencia ?? "").trim(),
      categoria: String(origem.categoria ?? "").trim(),
      marca: String(origem.marca ?? "").trim(),
      designacao: String(origem.designacao ?? "").trim(),
      quantidade: Math.max(0, Number(origem.quantidade ?? 0)),
      local: String(origem.local ?? "").trim() || null,
      extras,
    };
  };

  const iniciarEdicao = (peca) => {
    const novoDraft = {
      referencia: peca.referencia ?? "",
      categoria: peca.categoria ?? "",
      marca: peca.marca ?? "",
      designacao: peca.designacao ?? "",
      quantidade: Number(peca.quantidade ?? 0),
      local: peca.local ?? "",
    };

    for (const coluna of colunasVisiveis) {
      novoDraft[coluna.chave] = obterValorColuna(peca, coluna.chave) ?? "";
    }
    setCriandoNovo(false);
    setDraftNovo(criarDraftVazio(colunasVisiveis));
    setEditandoId(peca.id);
    setDraft(novoDraft);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setDraft({});
  };

  const cancelarNovo = () => {
    setCriandoNovo(false);
    setDraftNovo(criarDraftVazio(colunasVisiveis));
  };

  const atualizarDraft = (chave, valor) => {
    setDraft((anterior) => ({
      ...anterior,
      [chave]: valor,
    }));
  };

  const atualizarDraftNovo = (chave, valor) => {
    setDraftNovo((anterior) => ({
      ...anterior,
      [chave]: valor,
    }));
  };

  const guardarEdicao = async (peca) => {
    const payload = montarPayload(draft);
    const sucesso = await onGuardarEdicao(peca, payload);
    if (sucesso) {
      cancelarEdicao();
    }
  };

  const guardarNovo = async () => {
    if (typeof onCriarNovo !== "function") {
      return;
    }
    const payload = montarPayload(draftNovo);
    const sucesso = await onCriarNovo(payload);
    if (sucesso) {
      cancelarNovo();
    }
  };

  if (loading) {
    return (
      <section className="painel painel-tabela">
        <p className="estado">A carregar pecas...</p>
      </section>
    );
  }

  if (!pecas.length && !criandoNovo) {
    return (
      <section className="painel painel-tabela">
        <p className="estado">Nenhuma peca encontrada para os filtros atuais.</p>
      </section>
    );
  }

  return (
    <section className="painel painel-tabela" ref={tabelaRef}>
      <div className={`tabela-wrapper ${classeDensidade}`.trim()}>
        <table>
          <thead>
            <tr>
              {colunasVisiveis.map((coluna) => {
                const estaAtiva = ordenacao?.campo === coluna.chave;
                const direcao = estaAtiva ? ordenacao?.direcao : null;
                return (
                  <th key={coluna.chave}>
                    <span className="th-conteudo">
                      <span className="th-texto">{coluna.nome}</span>
                      <button
                        type="button"
                        className={`botao-ordenar${estaAtiva ? " ativa" : ""}`}
                        aria-label={
                          estaAtiva && direcao === "asc"
                            ? `Ordenar ${coluna.nome} de Z para A`
                            : `Ordenar ${coluna.nome} de A para Z`
                        }
                        title={estaAtiva && direcao === "asc" ? `Ordenado A-Z. Clique para Z-A` : `Ordenar A-Z`}
                        onClick={() => onOrdenar(coluna.chave)}
                      >
                        <IconeOrdenacao ativo={estaAtiva} direcao={direcao} />
                      </button>
                    </span>
                  </th>
                );
              })}
              <th className="coluna-acoes">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {criandoNovo ? (
              <tr className="linha-novo-material">
                {colunasVisiveis.map((coluna) => {
                  const isQuantidade = coluna.chave === "quantidade";
                  const valor = draftNovo[coluna.chave] ?? (isQuantidade ? 0 : "");
                  return (
                    <td key={`novo-${coluna.chave}`}>
                      <input
                        className="input-inline-tabela"
                        type={isQuantidade ? "number" : "text"}
                        min={isQuantidade ? "0" : undefined}
                        value={valor}
                        onChange={(event) => atualizarDraftNovo(coluna.chave, event.target.value)}
                        disabled={loadingCriacao}
                        placeholder={isQuantidade ? "0" : coluna.nome}
                      />
                    </td>
                  );
                })}

                <td className="coluna-acoes">
                  <div className="acoes-linha">
                    <button
                      type="button"
                      className="botao-acao botao-guardar"
                      onClick={guardarNovo}
                      disabled={loadingCriacao}
                      title="Guardar novo material"
                    >
                      <IconeGuardar />
                    </button>
                    <button
                      type="button"
                      className="botao-acao botao-cancelar"
                      onClick={cancelarNovo}
                      disabled={loadingCriacao}
                      title="Cancelar novo material"
                    >
                      <IconeCancelar />
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}

            {pecas.map((peca) => {
              const emCurso = operacaoEmCursoId === peca.id;
              const emEdicao = editandoId === peca.id;
              const bloquearLinha = criandoNovo || loadingCriacao;

              return (
                <tr key={peca.id}>
                  {colunasVisiveis.map((coluna) => {
                    if (emEdicao) {
                      const valor = draft[coluna.chave] ?? "";
                      const isQuantidade = coluna.chave === "quantidade";
                      return (
                        <td key={`${peca.id}-${coluna.chave}`}>
                          <input
                            className="input-inline-tabela"
                            type={isQuantidade ? "number" : "text"}
                            min={isQuantidade ? "0" : undefined}
                            value={valor}
                            onChange={(event) => atualizarDraft(coluna.chave, event.target.value)}
                            disabled={emCurso}
                          />
                        </td>
                      );
                    }

                    if (coluna.chave === "quantidade") {
                      return (
                        <td key={`${peca.id}-${coluna.chave}`}>
                          <div className="quantidade-box">
                            <button
                              type="button"
                              className="botao-quantidade"
                              disabled={emCurso || bloquearLinha || peca.quantidade <= 0}
                              onClick={() => onAlterarQuantidade(peca, peca.quantidade - 1)}
                            >
                              -
                            </button>
                            <span>{peca.quantidade}</span>
                            <button
                              type="button"
                              className="botao-quantidade"
                              disabled={emCurso || bloquearLinha}
                              onClick={() => onAlterarQuantidade(peca, peca.quantidade + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                      );
                    }

                    const valor = obterValorColuna(peca, coluna.chave);
                    return <td key={`${peca.id}-${coluna.chave}`}>{valor ?? "-"}</td>;
                  })}

                  <td className="coluna-acoes">
                    <div className="acoes-linha">
                      {emEdicao ? (
                        <>
                          <button
                            type="button"
                            className="botao-acao botao-guardar"
                            onClick={() => guardarEdicao(peca)}
                            disabled={emCurso}
                            title="Guardar alteracoes"
                          >
                            <IconeGuardar />
                          </button>
                          <button
                            type="button"
                            className="botao-acao botao-cancelar"
                            onClick={cancelarEdicao}
                            disabled={emCurso}
                            title="Cancelar edicao"
                          >
                            <IconeCancelar />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="botao-acao botao-editar"
                            onClick={() => iniciarEdicao(peca)}
                            disabled={emCurso || bloquearLinha}
                            title="Editar linha"
                          >
                            <IconeEditar />
                          </button>

                          <button
                            type="button"
                            className="botao-acao botao-eliminar"
                            onClick={() => onEliminar(peca)}
                            disabled={emCurso || bloquearLinha}
                            title="Eliminar peca"
                          >
                            <IconeEliminar />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
