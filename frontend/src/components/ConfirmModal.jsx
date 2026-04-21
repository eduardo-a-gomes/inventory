/**
 * Modal de confirmação reutilizável.
 */
export default function ConfirmModal({
  aberto,
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  perigo = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!aberto) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacao">
      <div className="modal-card modal-confirm-card">
        <h3 id="titulo-confirmacao">{titulo}</h3>
        <p className="modal-ajuda">{mensagem}</p>

        <div className="confirm-actions">
          <button type="button" className="botao-secundario" onClick={onCancel} disabled={loading}>
            {textoCancelar}
          </button>
          <button type="button" className={perigo ? "botao-perigo" : ""} onClick={onConfirm} disabled={loading}>
            {loading ? "A confirmar..." : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}


