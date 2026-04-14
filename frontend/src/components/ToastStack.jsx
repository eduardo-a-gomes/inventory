/**
 * Notificacoes flutuantes sem impactar o layout principal.
 */
export default function ToastStack({ itens, onFechar }) {
  if (!itens.length) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {itens.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tipo}`}>
          <span>{toast.mensagem}</span>
          <button type="button" className="toast-fechar" onClick={() => onFechar(toast.id)} aria-label="Fechar notificacao">
            x
          </button>
        </div>
      ))}
    </div>
  );
}

