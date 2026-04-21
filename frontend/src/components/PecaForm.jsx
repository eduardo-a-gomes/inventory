import { useEffect, useState } from "react";

const INITIAL_FORM = {
  referencia: "",
  categoria: "",
  marca: "",
  designacao: "",
  preco: "0.00",
  quantidade: 1,
  local: "",
  extras: {},
};

const CHAVES_BASE = new Set(["referencia", "categoria", "marca", "designacao", "preco", "quantidade", "local"]);
const MAX_TEXTO_MATERIAL = 2048;

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

/**
 * Formulário reutilizável para criar ou editar peças.
 */
export default function PecaForm({ modo, pecaSelecionada, colunas, onSubmit, onCancel, loading, semCartao = false }) {
  const [form, setForm] = useState(INITIAL_FORM);

  const colunasExtras = colunas.filter((coluna) => !CHAVES_BASE.has(coluna.chave));
  const nomeBasePorChave = new Map(colunas.map((coluna) => [coluna.chave, coluna.nome]));
  const obterNomeBase = (chave, fallback) => nomeBasePorChave.get(chave) || fallback;

  useEffect(() => {
    const extrasIniciais = {};
    for (const coluna of colunasExtras) {
      extrasIniciais[coluna.chave] = pecaSelecionada?.extras?.[coluna.chave] ?? "";
    }

    if (pecaSelecionada) {
      setForm({
        referencia: pecaSelecionada.referencia || "",
        categoria: pecaSelecionada.categoria || "",
        marca: pecaSelecionada.marca || "",
        designacao: pecaSelecionada.designacao || "",
        preco: Number(pecaSelecionada.preco || 0).toFixed(2),
        quantidade: Number(pecaSelecionada.quantidade || 0),
        local: pecaSelecionada.local || "",
        extras: extrasIniciais,
      });
      return;
    }
    setForm({ ...INITIAL_FORM, extras: extrasIniciais });
  }, [pecaSelecionada, colunas]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name.startsWith("extra:")) {
      const chave = name.replace("extra:", "");
      setForm((prev) => ({
        ...prev,
        extras: {
          ...prev.extras,
          [chave]: value,
        },
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: name === "quantidade" ? Number(value) : name === "preco" ? normalizarInputPreco(value) : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const extrasNormalizados = {};
    for (const coluna of colunasExtras) {
      const valor = form.extras?.[coluna.chave];
      const texto = String(valor ?? "").trim();
      extrasNormalizados[coluna.chave] = texto || null;
    }

    onSubmit({
      ...form,
      preco: precoParaNumero(form.preco),
      quantidade: Number.isNaN(form.quantidade) ? 0 : Math.max(0, Number(form.quantidade)),
      local: form.local?.trim() || null,
      extras: extrasNormalizados,
    });
  };

  const conteudoFormulario = (
    <>
      <div className="painel-header">
        <h2>{modo === "editar" ? "Editar material" : "Novo material"}</h2>
      </div>

      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          {obterNomeBase("referencia", "Referência")}
          <input name="referencia" value={form.referencia} onChange={handleChange} required maxLength={MAX_TEXTO_MATERIAL} />
        </label>

        <label>
          {obterNomeBase("categoria", "Categoria")}
          <input name="categoria" value={form.categoria} onChange={handleChange} required maxLength={MAX_TEXTO_MATERIAL} />
        </label>

        <label>
          {obterNomeBase("marca", "Marca")}
          <input name="marca" value={form.marca} onChange={handleChange} required maxLength={MAX_TEXTO_MATERIAL} />
        </label>

        <label>
          {obterNomeBase("designacao", "Designação")}
          <input name="designacao" value={form.designacao} onChange={handleChange} required maxLength={MAX_TEXTO_MATERIAL} />
        </label>

        <label>
          {obterNomeBase("preco", "Preço")}
          <div className="input-preco-wrapper">
            <input
              name="preco"
              className="input-preco"
              type="text"
              inputMode="decimal"
              value={form.preco}
              onChange={handleChange}
              placeholder="0.00"
              required
            />
            <span>€</span>
          </div>
        </label>

        <label>
          {obterNomeBase("quantidade", "Quantidade")}
          <input name="quantidade" type="number" min="0" value={form.quantidade} onChange={handleChange} required />
        </label>

        <label>
          {obterNomeBase("local", "Local")}
          <input
            name="local"
            value={form.local}
            onChange={handleChange}
            maxLength={MAX_TEXTO_MATERIAL}
            placeholder="Ex: Estante 2-B"
          />
        </label>

        {colunasExtras.map((coluna) => (
          <label key={coluna.chave}>
            {coluna.nome}
            <input
              name={`extra:${coluna.chave}`}
              value={form.extras?.[coluna.chave] ?? ""}
              onChange={handleChange}
              maxLength={MAX_TEXTO_MATERIAL}
            />
          </label>
        ))}

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "A guardar..." : modo === "editar" ? "Guardar alterações" : "Adicionar material"}
          </button>
          {typeof onCancel === "function" ? (
            <button type="button" className="botao-secundario" onClick={onCancel}>
              {modo === "editar" ? "Cancelar edição" : "Fechar"}
            </button>
          ) : null}
        </div>
      </form>
    </>
  );

  if (semCartao) {
    return <>{conteudoFormulario}</>;
  }

  return <section className="painel painel-form">{conteudoFormulario}</section>;
}

