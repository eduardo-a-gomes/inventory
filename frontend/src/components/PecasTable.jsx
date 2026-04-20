import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Tabela principal de pecas do inventario.
 */
const COLUNAS_PADRAO = [
  { chave: "referencia", nome: "Referencia" },
  { chave: "categoria", nome: "Categoria" },
  { chave: "marca", nome: "Marca" },
  { chave: "designacao", nome: "Designacao" },
  { chave: "local", nome: "Local" },
  { chave: "preco", nome: "Preço" },
  { chave: "quantidade", nome: "Quantidade" },
];
const CHAVES_BASE = new Set(["referencia", "categoria", "marca", "designacao", "preco", "quantidade", "local"]);
const CHAVE_PRECO = "preco";
const CHAVE_QUANTIDADE = "quantidade";
const QUANTIDADE_INICIAL_NOVO_MATERIAL = 1;
const MAX_TEXTO_MATERIAL = 2048;
const URL_PATTERN = /^(https?:\/\/|www\.)\S+$/i;

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

function IconeLink() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function obterValorColuna(peca, chave) {
  if (Object.prototype.hasOwnProperty.call(peca, chave)) {
    return peca[chave];
  }
  return peca.extras?.[chave];
}

function obterUrlNormalizado(valor) {
  const texto = String(valor ?? "").trim();
  if (!URL_PATTERN.test(texto)) {
    return null;
  }
  return texto.startsWith("www.") ? `https://${texto}` : texto;
}

function obterDominioUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "Abrir link";
  }
}

function formatarPreco(valor) {
  const numero = Number(valor ?? 0);
  const seguro = Number.isFinite(numero) ? Math.max(0, numero) : 0;
  return `${seguro.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function normalizarInputPreco(valor) {
  const texto = String(valor ?? "").replace(",", ".");
  const apenasNumeros = texto.replace(/[^\d.]/g, "");
  const [inteiros = "", ...decimaisPartes] = apenasNumeros.split(".");
  const decimais = decimaisPartes.join("").slice(0, 2);
  return decimaisPartes.length ? `${inteiros}.${decimais}` : inteiros;
}

function precoParaNumero(valor) {
  const numero = Number(String(valor ?? "").replace(",", "."));
  if (!Number.isFinite(numero)) {
    return 0;
  }
  return Math.round(Math.max(0, numero) * 100) / 100;
}

function criarDraftVazio(colunasVisiveis) {
  const draft = {
    referencia: "",
    categoria: "",
    marca: "",
    designacao: "",
    preco: "0.00",
    quantidade: QUANTIDADE_INICIAL_NOVO_MATERIAL,
    local: "",
  };

  for (const coluna of colunasVisiveis) {
    if (coluna.chave === CHAVE_PRECO) {
      draft[coluna.chave] = "0.00";
      continue;
    }
    if (coluna.chave === CHAVE_QUANTIDADE) {
      draft[coluna.chave] = QUANTIDADE_INICIAL_NOVO_MATERIAL;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(draft, coluna.chave)) {
      draft[coluna.chave] = "";
    }
  }
  return draft;
}

function ordenarColunasTabela(colunasOrigem) {
  const colunas = Array.isArray(colunasOrigem) ? colunasOrigem : [];
  const colunaQuantidade =
    colunas.find((coluna) => coluna.chave === CHAVE_QUANTIDADE) || COLUNAS_PADRAO.find((coluna) => coluna.chave === CHAVE_QUANTIDADE);
  const colunaPreco =
    colunas.find((coluna) => coluna.chave === CHAVE_PRECO) || COLUNAS_PADRAO.find((coluna) => coluna.chave === CHAVE_PRECO);
  const restantes = colunas.filter((coluna) => coluna.chave !== CHAVE_QUANTIDADE && coluna.chave !== CHAVE_PRECO);
  return [...restantes, ...(colunaPreco ? [colunaPreco] : []), ...(colunaQuantidade ? [colunaQuantidade] : [])];
}

export default function PecasTable({
  pecas,
  colunas,
  loading,
  onGuardarEdicao,
  onEliminar,
  onAlterarQuantidade,
  onRegistarVenda,
  operacaoEmCursoId,
  ordenacao,
  onOrdenar,
  tokenNovoMaterial = 0,
  loadingCriacao = false,
  onCriarNovo,
}) {
  const colunasVisiveis = useMemo(() => {
    const colunasBase = colunas.length ? colunas : COLUNAS_PADRAO;
    return ordenarColunasTabela(colunasBase);
  }, [colunas]);
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
      if (coluna.chave === CHAVE_PRECO) {
        return precoParaNumero(valor) > 0;
      }
      if (coluna.chave === CHAVE_QUANTIDADE) {
        return Number(valor ?? QUANTIDADE_INICIAL_NOVO_MATERIAL) !== QUANTIDADE_INICIAL_NOVO_MATERIAL;
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
      preco: precoParaNumero(origem.preco),
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
      preco: Number(peca.preco ?? 0).toFixed(2),
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
      [chave]: chave === CHAVE_PRECO ? normalizarInputPreco(valor) : valor,
    }));
  };

  const atualizarDraftNovo = (chave, valor) => {
    setDraftNovo((anterior) => ({
      ...anterior,
      [chave]: chave === CHAVE_PRECO ? normalizarInputPreco(valor) : valor,
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

  const renderizarValorCelula = (valor) => {
    if (typeof valor === "number") {
      return valor;
    }

    const url = obterUrlNormalizado(valor);
    if (!url) {
      return valor ?? "-";
    }

    const dominio = obterDominioUrl(url);
    return (
      <div className="celula-link" title={url}>
        <a className="link-resumido" href={url} target="_blank" rel="noreferrer" title={`Abrir ${url}`}>
          <IconeLink />
          {dominio}
        </a>
      </div>
    );
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
                  const isPreco = coluna.chave === CHAVE_PRECO;
                  const isQuantidade = coluna.chave === CHAVE_QUANTIDADE;
                  if (isPreco) {
                    const valorPreco = draftNovo[coluna.chave] ?? "0.00";
                    return (
                      <td key={`novo-${coluna.chave}`}>
                        <div className="input-preco-wrapper">
                          <input
                            className="input-inline-tabela input-preco"
                            type="text"
                            inputMode="decimal"
                            value={valorPreco}
                            onChange={(event) => atualizarDraftNovo(coluna.chave, event.target.value)}
                            disabled={loadingCriacao}
                            placeholder="0.00"
                          />
                          <span>€</span>
                        </div>
                      </td>
                    );
                  }
                  if (isQuantidade) {
                    const quantidadeAtual = Math.max(0, Number(draftNovo[coluna.chave] ?? QUANTIDADE_INICIAL_NOVO_MATERIAL));
                    return (
                      <td key={`novo-${coluna.chave}`}>
                        <div className="quantidade-box">
                          <button
                            type="button"
                            className="botao-quantidade"
                            disabled={loadingCriacao || quantidadeAtual <= 0}
                            onClick={() => atualizarDraftNovo(coluna.chave, Math.max(0, quantidadeAtual - 1))}
                          >
                            -
                          </button>
                          <span>{quantidadeAtual}</span>
                          <button
                            type="button"
                            className="botao-quantidade"
                            disabled={loadingCriacao}
                            onClick={() => atualizarDraftNovo(coluna.chave, quantidadeAtual + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                    );
                  }

                  const valor = draftNovo[coluna.chave] ?? "";
                  return (
                    <td key={`novo-${coluna.chave}`}>
                      <input
                        className="input-inline-tabela"
                        type="text"
                        value={valor}
                        onChange={(event) => atualizarDraftNovo(coluna.chave, event.target.value)}
                        disabled={loadingCriacao}
                        maxLength={MAX_TEXTO_MATERIAL}
                        placeholder={coluna.nome}
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
                      const isPreco = coluna.chave === CHAVE_PRECO;
                      const isQuantidade = coluna.chave === CHAVE_QUANTIDADE;
                      if (isPreco) {
                        return (
                          <td key={`${peca.id}-${coluna.chave}`}>
                            <div className="input-preco-wrapper">
                              <input
                                className="input-inline-tabela input-preco"
                                type="text"
                                inputMode="decimal"
                                value={valor}
                                onChange={(event) => atualizarDraft(coluna.chave, event.target.value)}
                                disabled={emCurso}
                                placeholder="0.00"
                              />
                              <span>€</span>
                            </div>
                          </td>
                        );
                      }
                      if (isQuantidade) {
                        const quantidadeAtual = Math.max(0, Number(valor || 0));
                        return (
                          <td key={`${peca.id}-${coluna.chave}`}>
                            <div className="quantidade-box">
                              <button
                                type="button"
                                className="botao-quantidade"
                                disabled={emCurso || quantidadeAtual <= 0}
                                onClick={() => atualizarDraft(coluna.chave, Math.max(0, quantidadeAtual - 1))}
                              >
                                -
                              </button>
                              <span>{quantidadeAtual}</span>
                              <button
                                type="button"
                                className="botao-quantidade"
                                disabled={emCurso}
                                onClick={() => atualizarDraft(coluna.chave, quantidadeAtual + 1)}
                              >
                                +
                              </button>
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={`${peca.id}-${coluna.chave}`}>
                          <input
                            className="input-inline-tabela"
                            type="text"
                            maxLength={MAX_TEXTO_MATERIAL}
                            value={valor}
                            onChange={(event) => atualizarDraft(coluna.chave, event.target.value)}
                            disabled={emCurso}
                          />
                        </td>
                      );
                    }

                    if (coluna.chave === CHAVE_PRECO) {
                      return <td key={`${peca.id}-${coluna.chave}`}>{formatarPreco(peca.preco)}</td>;
                    }

                    if (coluna.chave === CHAVE_QUANTIDADE) {
                      return (
                        <td key={`${peca.id}-${coluna.chave}`}>
                          <div className="quantidade-box">
                            <button
                              type="button"
                              className="botao-quantidade"
                              disabled={emCurso || bloquearLinha || peca.quantidade <= 0}
                              onClick={() => onRegistarVenda?.(peca, 1)}
                              title="Registar venda de 1 unidade"
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
                    return <td key={`${peca.id}-${coluna.chave}`}>{renderizarValorCelula(valor)}</td>;
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
