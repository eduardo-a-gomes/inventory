import { useEffect, useMemo, useState } from "react";

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

export default function VendaModal({ aberto, peca, loading = false, onConfirm, onCancel }) {
  const [quantidade, setQuantidade] = useState(1);
  const [precoUnitario, setPrecoUnitario] = useState("0.00");

  useEffect(() => {
    if (!aberto || !peca) {
      return;
    }

    setQuantidade(1);
    setPrecoUnitario(Number(peca.preco ?? 0).toFixed(2));
  }, [aberto, peca]);

  const total = useMemo(() => precoParaNumero(precoUnitario) * Math.max(1, Number(quantidade || 1)), [precoUnitario, quantidade]);

  if (!aberto || !peca) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-venda">
      <div className="modal-card modal-venda-card">
        <div className="modal-header">
          <h3 id="titulo-venda">Registar venda</h3>
        </div>

        <p className="modal-ajuda">
          {peca.designacao || "Material sem designacao"}{peca.referencia ? ` - ${peca.referencia}` : ""}
        </p>

        <div className="form-grid">
          <label>
            Quantidade vendida
            <input
              type="number"
              min="1"
              max={Math.max(1, Number(peca.quantidade ?? 1))}
              value={quantidade}
              onChange={(event) => setQuantidade(Math.max(1, Math.min(Number(peca.quantidade ?? 1), Number(event.target.value || 1))))}
              disabled={loading}
            />
          </label>

          <label>
            Preco unitario da venda
            <div className="input-preco-wrapper">
              <input
                className="input-preco"
                type="text"
                inputMode="decimal"
                value={precoUnitario}
                onChange={(event) => setPrecoUnitario(normalizarInputPreco(event.target.value))}
                disabled={loading}
                placeholder="0.00"
              />
              <span>€</span>
            </div>
          </label>
        </div>

        <p className="modal-ajuda">Total da venda: {total.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>

        <div className="confirm-actions">
          <button type="button" className="botao-secundario" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm?.({
                quantidade: Math.max(1, Number(quantidade || 1)),
                preco_unitario: precoParaNumero(precoUnitario),
              })
            }
            disabled={loading}
          >
            {loading ? "A registar..." : "Registar venda"}
          </button>
        </div>
      </div>
    </div>
  );
}
