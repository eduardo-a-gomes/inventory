import { useEffect, useState } from "react";

const INITIAL_FORM = {
  referencia: "",
  categoria: "",
  marca: "",
  designacao: "",
  quantidade: 0,
  local: "",
  extras: {},
};

const CHAVES_BASE = new Set(["referencia", "categoria", "marca", "designacao", "quantidade", "local"]);

/**
 * Formulario reutilizavel para criar ou editar pecas.
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
      [name]: name === "quantidade" ? Number(value) : value,
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
          {obterNomeBase("referencia", "Referencia")}
          <input name="referencia" value={form.referencia} onChange={handleChange} required maxLength={100} />
        </label>

        <label>
          {obterNomeBase("categoria", "Categoria")}
          <input name="categoria" value={form.categoria} onChange={handleChange} required maxLength={100} />
        </label>

        <label>
          {obterNomeBase("marca", "Marca")}
          <input name="marca" value={form.marca} onChange={handleChange} required maxLength={100} />
        </label>

        <label>
          {obterNomeBase("designacao", "Designacao")}
          <input name="designacao" value={form.designacao} onChange={handleChange} required maxLength={200} />
        </label>

        <label>
          {obterNomeBase("quantidade", "Quantidade")}
          <input name="quantidade" type="number" min="0" value={form.quantidade} onChange={handleChange} required />
        </label>

        <label>
          {obterNomeBase("local", "Local")}
          <input name="local" value={form.local} onChange={handleChange} maxLength={100} placeholder="Ex: Estante 2-B" />
        </label>

        {colunasExtras.map((coluna) => (
          <label key={coluna.chave}>
            {coluna.nome}
            <input
              name={`extra:${coluna.chave}`}
              value={form.extras?.[coluna.chave] ?? ""}
              onChange={handleChange}
              maxLength={200}
            />
          </label>
        ))}

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "A guardar..." : modo === "editar" ? "Guardar alteracoes" : "Adicionar material"}
          </button>
          {typeof onCancel === "function" ? (
            <button type="button" className="botao-secundario" onClick={onCancel}>
              {modo === "editar" ? "Cancelar edicao" : "Fechar"}
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
