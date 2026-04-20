function formatarEuro(valor) {
  const numero = Number(valor ?? 0);
  const seguro = Number.isFinite(numero) ? Math.max(0, numero) : 0;
  return `${seguro.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatarInteiro(valor) {
  const numero = Number(valor ?? 0);
  const seguro = Number.isFinite(numero) ? Math.max(0, numero) : 0;
  return seguro.toLocaleString("pt-PT");
}

function formatarDataHora(valor) {
  if (!valor) {
    return "-";
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return data.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GraficoColunas({ titulo, dados, formatador = formatarEuro, vazio = "Ainda nao ha dados suficientes." }) {
  if (!dados?.length) {
    return (
      <section className="dashboard-bloco">
        <div className="dashboard-bloco-topo">
          <h2>{titulo}</h2>
        </div>
        <p className="estado">{vazio}</p>
      </section>
    );
  }

  const maximo = Math.max(...dados.map((item) => Number(item.valor ?? 0)), 1);

  return (
    <section className="dashboard-bloco">
      <div className="dashboard-bloco-topo">
        <h2>{titulo}</h2>
      </div>

      <div className="grafico-colunas" role="img" aria-label={titulo}>
        {dados.map((item) => {
          const valor = Number(item.valor ?? 0);
          const altura = Math.max(10, Math.round((valor / maximo) * 100));

          return (
            <div className="grafico-coluna-item" key={`${titulo}-${item.etiqueta}`}>
              <span className="grafico-coluna-valor">{formatador(valor)}</span>
              <div className="grafico-coluna-trilho">
                <div className="grafico-coluna-barra" style={{ height: `${altura}%` }} />
              </div>
              <span className="grafico-coluna-etiqueta" title={item.etiqueta}>
                {item.etiqueta}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GraficoBarras({ titulo, dados, formatador = formatarEuro, vazio = "Ainda nao ha dados suficientes." }) {
  if (!dados?.length) {
    return (
      <section className="dashboard-bloco">
        <div className="dashboard-bloco-topo">
          <h2>{titulo}</h2>
        </div>
        <p className="estado">{vazio}</p>
      </section>
    );
  }

  const maximo = Math.max(...dados.map((item) => Number(item.valor ?? 0)), 1);

  return (
    <section className="dashboard-bloco">
      <div className="dashboard-bloco-topo">
        <h2>{titulo}</h2>
      </div>

      <div className="grafico-barras" role="img" aria-label={titulo}>
        {dados.map((item) => {
          const valor = Number(item.valor ?? 0);
          const largura = Math.max(8, Math.round((valor / maximo) * 100));

          return (
            <div className="grafico-barra-linha" key={`${titulo}-${item.etiqueta}`}>
              <div className="grafico-barra-cabecalho">
                <span className="grafico-barra-etiqueta" title={item.etiqueta}>
                  {item.etiqueta}
                </span>
                <strong>{formatador(valor)}</strong>
              </div>
              <div className="grafico-barra-trilho">
                <div className="grafico-barra-preenchimento" style={{ width: `${largura}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function DashboardVendas({ dashboard, loading }) {
  const resumo = dashboard?.resumo || {
    faturacao_total: 0,
    valor_em_stock: 0,
    total_vendas: 0,
    unidades_vendidas: 0,
  };
  const historico = dashboard?.historico || [];

  if (loading) {
    return (
      <section className="painel painel-dashboard">
        <p className="estado">A carregar dashboard de vendas...</p>
      </section>
    );
  }

  return (
    <section className="painel painel-dashboard">
      <div className="dashboard-kpis">
        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Faturacao total</span>
          <strong>{formatarEuro(resumo.faturacao_total)}</strong>
        </article>

        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Valor atual em stock</span>
          <strong>{formatarEuro(resumo.valor_em_stock)}</strong>
        </article>

        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Vendas registadas</span>
          <strong>{formatarInteiro(resumo.total_vendas)}</strong>
        </article>

        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Unidades vendidas</span>
          <strong>{formatarInteiro(resumo.unidades_vendidas)}</strong>
        </article>
      </div>

      <div className="dashboard-graficos">
        <GraficoColunas
          titulo="Faturacao por mes"
          dados={dashboard?.faturacao_por_mes || []}
          vazio="Ainda nao existem vendas para formar este grafico."
        />

        <GraficoBarras
          titulo="Valor em stock por categoria"
          dados={dashboard?.valor_stock_por_categoria || []}
          vazio="Ainda nao existe stock com valor para mostrar."
        />

        <GraficoBarras
          titulo="Materiais com mais faturacao"
          dados={dashboard?.faturacao_por_material || []}
          vazio="Ainda nao existem materiais vendidos para comparar."
        />
      </div>

      <section className="dashboard-bloco">
        <div className="dashboard-bloco-topo">
          <h2>Historico de vendas</h2>
          <span>{formatarInteiro(historico.length)} registos</span>
        </div>

        {!historico.length ? (
          <p className="estado">Ainda nao ha vendas registadas.</p>
        ) : (
          <div className="dashboard-tabela-wrapper">
            <table className="dashboard-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Referencia</th>
                  <th>Designacao</th>
                  <th>Categoria</th>
                  <th>Qtd.</th>
                  <th>Preco venda</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((venda) => (
                  <tr key={venda.id}>
                    <td>{formatarDataHora(venda.vendida_em)}</td>
                    <td>{venda.referencia || "-"}</td>
                    <td>{venda.designacao || "-"}</td>
                    <td>{venda.categoria || "-"}</td>
                    <td>{formatarInteiro(venda.quantidade_vendida)}</td>
                    <td>{formatarEuro(venda.preco_unitario)}</td>
                    <td>{formatarEuro(venda.total_venda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
