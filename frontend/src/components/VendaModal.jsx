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
  const [precoTotal, setPrecoTotal] = useState("0.00");
  const [precoFoiEditado, setPrecoFoiEditado] = useState(false);
  const quantidadeMaxima = Math.max(1, Number(peca?.quantidade ?? 1));

  useEffect(() => {
    if (!aberto || !peca) {
      return;
    }

    setQuantidade(1);
    setPrecoTotal(Number(peca.preco ?? 0).toFixed(2));
    setPrecoFoiEditado(false);
  }, [aberto, peca]);

  useEffect(() => {
    if (!aberto || !peca || precoFoiEditado) {
      return;
    }

    const totalBase = precoParaNumero(peca.preco) * Math.max(1, Number(quantidade || 1));
    setPrecoTotal(totalBase.toFixed(2));
  }, [aberto, peca, precoFoiEditado, quantidade]);

  const total = useMemo(() => precoParaNumero(precoTotal), [precoTotal]);
  const precoUnitarioCalculado = useMemo(() => {
    const quantidadeSegura = Math.max(1, Number(quantidade || 1));
    return total / quantidadeSegura;
  }, [total, quantidade]);

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
          {peca.designacao || "Material sem designação"}{peca.referencia ? ` - ${peca.referencia}` : ""}
        </p>

        <div className="form-grid">
          <label>
            Quantidade vendida
            <div className="quantidade-box quantidade-box-venda">
              <button
                type="button"
                className="botao-quantidade"
                disabled={loading || quantidade <= 1}
                onClick={() => setQuantidade((valorAtual) => Math.max(1, valorAtual - 1))}
                title="Diminuir quantidade"
              >
                -
              </button>
              <span>{quantidade}</span>
              <button
                type="button"
                className="botao-quantidade"
                disabled={loading || quantidade >= quantidadeMaxima}
                onClick={() => setQuantidade((valorAtual) => Math.min(quantidadeMaxima, valorAtual + 1))}
                title="Aumentar quantidade"
              >
                +
              </button>
            </div>
            <span className="quantidade-venda-limite">Máximo disponível: {quantidadeMaxima}</span>
          </label>

          <label>
            Preço total da venda
            <div className="input-preco-wrapper">
              <input
                className="input-preco"
                type="text"
                inputMode="decimal"
                value={precoTotal}
                onChange={(event) => {
                  setPrecoFoiEditado(true);
                  setPrecoTotal(normalizarInputPreco(event.target.value));
                }}
                disabled={loading}
                placeholder="0.00"
              />
              <span>€</span>
            </div>
          </label>
        </div>
        <div className="confirm-actions">
          <button type="button" className="botao-secundario" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm?.({
                quantidade: Math.max(1, Number(quantidade || 1)),
                preco_total: precoParaNumero(precoTotal),
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

