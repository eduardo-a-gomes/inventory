import { useEffect, useState } from "react";

const CHAVE_PRECO = "preco";
const CHAVE_QUANTIDADE = "quantidade";
const CHAVES_FIXAS = new Set([CHAVE_PRECO, CHAVE_QUANTIDADE]);

function normalizarOrdemComFixasNoFim(chaves = []) {
  const chavesValidas = chaves.filter(Boolean);
  const semFixas = chavesValidas.filter((chave) => !CHAVES_FIXAS.has(chave));
  const fixas = [];
  if (chavesValidas.includes(CHAVE_PRECO)) {
    fixas.push(CHAVE_PRECO);
  }
  if (!chavesValidas.includes(CHAVE_QUANTIDADE)) {
    return [...semFixas, ...fixas];
  }
  return [...semFixas, ...fixas, CHAVE_QUANTIDADE];
}

function IconeMais() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconeFechar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

function IconeLapis() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function IconeLixo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function IconeArrastar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="6" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
      <circle cx="8" cy="18" r="1.5" />
      <circle cx="16" cy="6" r="1.5" />
      <circle cx="16" cy="12" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </svg>
  );
}

/**
 * Normaliza nomes para comparacao sem diferenca de maiusculas/minusculas e acentos.
 */
function normalizarNome(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Modal para gerir colunas do inventario.
 */
export default function SchemaManagerModal({ aberto, colunas, loading, onFechar, onAdicionar, onRenomear, onRemover, onReordenar }) {
  const [mostrarInputNova, setMostrarInputNova] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [chaveEditando, setChaveEditando] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [erroNovaColuna, setErroNovaColuna] = useState("");
  const [ordemLocal, setOrdemLocal] = useState([]);
  const [chaveArrastar, setChaveArrastar] = useState(null);
  const [chaveAlvo, setChaveAlvo] = useState(null);

  useEffect(() => {
    if (!aberto) {
      return;
    }
    setMostrarInputNova(false);
    setNovoNome("");
    setChaveEditando(null);
    setNomeEdicao("");
    setErroNovaColuna("");
    setOrdemLocal(normalizarOrdemComFixasNoFim(colunas.map((coluna) => coluna.chave)));
    setChaveArrastar(null);
    setChaveAlvo(null);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) {
      return;
    }
    setOrdemLocal(normalizarOrdemComFixasNoFim(colunas.map((coluna) => coluna.chave)));
  }, [colunas, aberto]);

  if (!aberto) {
    return null;
  }

  const handleAdicionar = async () => {
    const nome = novoNome.trim();
    if (!nome) {
      setErroNovaColuna("Indica um nome para a nova coluna.");
      return;
    }

    const nomeNormalizado = normalizarNome(nome);
    const colunaDuplicada = colunas.some((coluna) => normalizarNome(coluna.nome) === nomeNormalizado);
    if (colunaDuplicada) {
      setErroNovaColuna("Ja existe uma coluna com esse nome.");
      return;
    }

    const sucesso = await onAdicionar(nome);
    if (sucesso) {
      setNovoNome("");
      setMostrarInputNova(false);
      setErroNovaColuna("");
    }
  };

  const iniciarEdicao = (coluna) => {
    setChaveEditando(coluna.chave);
    setNomeEdicao(coluna.nome);
  };

  const guardarEdicao = async (coluna) => {
    const nomeFinal = nomeEdicao.trim();
    if (!nomeFinal || normalizarNome(nomeFinal) === normalizarNome(coluna.nome)) {
      setChaveEditando(null);
      setNomeEdicao("");
      return;
    }

    await onRenomear(coluna, nomeFinal);
    setChaveEditando(null);
    setNomeEdicao("");
  };

  const colunasOrdenadas = ordemLocal
    .map((chave) => colunas.find((coluna) => coluna.chave === chave))
    .filter(Boolean);
  const colunasGeriveis = colunasOrdenadas.filter((coluna) => !CHAVES_FIXAS.has(coluna.chave));

  const moverColuna = async (chaveOrigem, chaveDestino) => {
    if (!chaveOrigem || !chaveDestino || chaveOrigem === chaveDestino) {
      return;
    }
    if (CHAVES_FIXAS.has(chaveOrigem) || CHAVES_FIXAS.has(chaveDestino)) {
      return;
    }

    const indiceOrigem = ordemLocal.findIndex((chave) => chave === chaveOrigem);
    const indiceDestino = ordemLocal.findIndex((chave) => chave === chaveDestino);
    if (indiceOrigem < 0 || indiceDestino < 0) {
      return;
    }

    const novasChaves = [...ordemLocal];
    const [chaveMovida] = novasChaves.splice(indiceOrigem, 1);
    novasChaves.splice(indiceDestino, 0, chaveMovida);
    const ordemNormalizada = normalizarOrdemComFixasNoFim(novasChaves);
    setOrdemLocal(ordemNormalizada);
    await onReordenar(ordemNormalizada);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-gerir-colunas">
      <div className="modal-card">
        <div className="modal-header">
          <h3 id="titulo-gerir-colunas">Gerir colunas</h3>
          <div className="acoes-modal-topo">
            <button
              type="button"
              className="botao-iconico botao-iconico-plus"
              onClick={() => setMostrarInputNova((prev) => !prev)}
              title="Adicionar nova coluna"
            >
              <IconeMais />
            </button>
            <button type="button" className="botao-iconico botao-fechar-x" onClick={onFechar} title="Fechar">
              <IconeFechar />
            </button>
          </div>
        </div>

        <p className="modal-ajuda">
          Ves aqui as colunas que podes gerir. As colunas Preço e Quantidade sao fixas e por isso nao aparecem nesta lista.
        </p>

        {mostrarInputNova ? (
          <div className="nova-coluna-box">
            <input
              value={novoNome}
              onChange={(event) => {
                setNovoNome(event.target.value);
                setErroNovaColuna("");
              }}
              placeholder="Nome da nova coluna"
              maxLength={80}
              disabled={loading}
            />
            <button type="button" className="botao-pequeno" onClick={handleAdicionar} disabled={loading || !novoNome.trim()}>
              Guardar
            </button>
            <button
              type="button"
              className="botao-secundario botao-pequeno"
              onClick={() => {
                setMostrarInputNova(false);
                setNovoNome("");
                setErroNovaColuna("");
              }}
              disabled={loading}
            >
              Cancelar
            </button>
            {erroNovaColuna ? <p className="aviso-coluna-duplicada">{erroNovaColuna}</p> : null}
          </div>
        ) : null}

        <ul className="lista-colunas lista-colunas-unica">
          {colunasGeriveis.map((coluna) => {
            const emEdicao = chaveEditando === coluna.chave;
            return (
              <li
                key={coluna.chave}
                className={`${chaveArrastar === coluna.chave ? "coluna-em-arrasto" : ""} ${chaveAlvo === coluna.chave ? "coluna-alvo" : ""}`.trim()}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!loading && !CHAVES_FIXAS.has(coluna.chave)) {
                    setChaveAlvo(coluna.chave);
                  }
                }}
                onDrop={async (event) => {
                  event.preventDefault();
                  if (CHAVES_FIXAS.has(coluna.chave)) {
                    return;
                  }
                  const origem = event.dataTransfer.getData("text/plain") || chaveArrastar;
                  await moverColuna(origem, coluna.chave);
                  setChaveArrastar(null);
                  setChaveAlvo(null);
                }}
              >
                <button
                  type="button"
                  className="botao-iconico botao-arrastar-coluna"
                  title={CHAVES_FIXAS.has(coluna.chave) ? "Esta coluna e fixa" : "Arrastar para mudar ordem da coluna"}
                  draggable={!loading && !CHAVES_FIXAS.has(coluna.chave)}
                  onDragStart={(event) => {
                    if (CHAVES_FIXAS.has(coluna.chave)) {
                      event.preventDefault();
                      return;
                    }
                    setChaveArrastar(coluna.chave);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", coluna.chave);
                  }}
                  onDragEnd={() => {
                    setChaveArrastar(null);
                    setChaveAlvo(null);
                  }}
                  disabled={loading || CHAVES_FIXAS.has(coluna.chave)}
                >
                  <IconeArrastar />
                </button>

                {emEdicao ? (
                  <input
                    className="input-renomear-coluna"
                    value={nomeEdicao}
                    onChange={(event) => setNomeEdicao(event.target.value)}
                    maxLength={80}
                    disabled={loading}
                  />
                ) : (
                  <span className="nome-coluna">{coluna.nome}</span>
                )}

                <div className="acoes-coluna-modal">
                  {emEdicao ? (
                    <>
                      <button type="button" className="botao-secundario botao-pequeno" onClick={() => guardarEdicao(coluna)} disabled={loading}>
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="botao-secundario botao-pequeno"
                        onClick={() => {
                          setChaveEditando(null);
                          setNomeEdicao("");
                        }}
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="botao-iconico botao-acao-coluna"
                      onClick={() => iniciarEdicao(coluna)}
                      title="Editar nome da coluna"
                      disabled={loading}
                    >
                      <IconeLapis />
                    </button>
                  )}

                  <button
                    type="button"
                    className="botao-iconico botao-acao-coluna botao-acao-coluna-perigo"
                    onClick={() => onRemover(coluna)}
                    title="Eliminar coluna"
                    disabled={loading}
                  >
                    <IconeLixo />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
