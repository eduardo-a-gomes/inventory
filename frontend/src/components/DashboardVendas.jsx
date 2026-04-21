import { useMemo, useState } from "react";

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

function formatarDataCurta(valor) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return data.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatarEuroEixo(valor) {
  const numero = Number(valor ?? 0);
  const seguro = Number.isFinite(numero) ? Math.max(0, numero) : 0;
  return `${seguro.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
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

function obterPassoDiasPorJanela(mesesVisiveis) {
  if (mesesVisiveis <= 0) {
    return 14;
  }
  if (mesesVisiveis <= 6) {
    return 7;
  }
  return 14;
}

function saoMesmoDia(dataA, dataB) {
  return (
    dataA.getFullYear() === dataB.getFullYear()
    && dataA.getMonth() === dataB.getMonth()
    && dataA.getDate() === dataB.getDate()
  );
}

function obterSerieTemporal(historico, mesesVisiveis) {
  const diaMs = 24 * 60 * 60 * 1000;
  const passoDiasSeguro = obterPassoDiasPorJanela(mesesVisiveis);
  const passoMsObjetivo = passoDiasSeguro * diaMs;

  const vendas = (historico || [])
    .map((venda) => {
      const data = new Date(venda.vendida_em);
      const valor = Number(venda.total_venda ?? 0);
      if (Number.isNaN(data.getTime()) || !Number.isFinite(valor)) {
        return null;
      }
      return { data, valor: Math.max(0, valor) };
    })
    .filter(Boolean)
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const inicio = new Date(hoje);
  if (mesesVisiveis > 0) {
    inicio.setMonth(inicio.getMonth() - mesesVisiveis);
  } else if (vendas.length) {
    inicio.setTime(vendas[0].data.getTime());
  } else {
    return [];
  }
  inicio.setHours(0, 0, 0, 0);

  const duracaoMs = Math.max(0, hoje.getTime() - inicio.getTime());
  const totalPontos = duracaoMs === 0
    ? 1
    : Math.max(2, Math.ceil(duracaoMs / passoMsObjetivo) + 1);
  const divisor = Math.max(totalPontos - 1, 1);
  const passoRealMs = divisor > 0 ? duracaoMs / divisor : 0;

  const pontosData = Array.from({ length: totalPontos }, (_, indice) => {
    const data = new Date(inicio.getTime() + indice * passoRealMs);
    data.setHours(0, 0, 0, 0);
    return data;
  });
  if (!pontosData.length || !saoMesmoDia(pontosData[pontosData.length - 1], hoje)) {
    pontosData[pontosData.length - 1] = new Date(hoje);
  }

  const fimHoje = new Date(hoje);
  fimHoje.setHours(23, 59, 59, 999);
  const vendasJanela = vendas.filter(
    (venda) => venda.data.getTime() >= inicio.getTime() && venda.data.getTime() <= fimHoje.getTime(),
  );

  let acumulado = 0;
  let indiceVenda = 0;
  const totalVendas = vendasJanela.length;

  return pontosData.map((dataPonto) => {
    const fimDia = new Date(dataPonto);
    fimDia.setHours(23, 59, 59, 999);

    while (indiceVenda < totalVendas && vendasJanela[indiceVenda].data.getTime() <= fimDia.getTime()) {
      acumulado += vendasJanela[indiceVenda].valor;
      indiceVenda += 1;
    }

    return {
      data: dataPonto,
      etiqueta: formatarDataCurta(dataPonto),
      valor: Math.round(acumulado * 100) / 100,
    };
  });
}

function GraficoLinhaTemporal({ serie, tituloAcessivel = "Vendas ao longo do tempo", vazio = "Ainda não existem vendas para formar este gráfico." }) {
  if (!serie?.length) {
    return (
      <section className="dashboard-bloco dashboard-bloco-grafico dashboard-bloco-grafico-linha">
        <p className="estado">{vazio}</p>
      </section>
    );
  }

  const largura = 1000;
  const altura = 320;
  const margem = { topo: 10, direita: 24, baixo: 42, esquerda: 96 };
  const larguraGrafico = largura - margem.esquerda - margem.direita;
  const alturaGrafico = altura - margem.topo - margem.baixo;

  const maximo = Math.max(...serie.map((ponto) => Number(ponto.valor ?? 0)), 1);

  const pontos = serie.map((ponto, indice) => {
    const fatorX = serie.length <= 1 ? 0.5 : indice / (serie.length - 1);
    const x = margem.esquerda + fatorX * larguraGrafico;
    const y = margem.topo + (1 - Number(ponto.valor ?? 0) / maximo) * alturaGrafico;
    return { ...ponto, x, y };
  });

  const caminhoLinha = pontos.map((ponto, indice) => `${indice === 0 ? "M" : "L"}${ponto.x} ${ponto.y}`).join(" ");
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const caminhoArea = `${caminhoLinha} L${ultimo.x} ${margem.topo + alturaGrafico} L${primeiro.x} ${margem.topo + alturaGrafico} Z`;

  const labels = [
    pontos[0],
    pontos[Math.floor((pontos.length - 1) / 2)],
    pontos[pontos.length - 1],
  ].filter((ponto, indice, array) => array.findIndex((item) => item.x === ponto.x) === indice);
  const niveisY = [0, 1, 2, 3, 4];
  const saltoMarcadores = Math.max(1, Math.ceil(pontos.length / 10));
  const pontosComMarcador = pontos.filter(
    (_, indice) => indice % saltoMarcadores === 0 || indice === pontos.length - 1,
  );

  return (
    <section className="dashboard-bloco dashboard-bloco-grafico dashboard-bloco-grafico-linha">
      <div className="grafico-linha-wrapper" role="img" aria-label={tituloAcessivel}>
        <svg viewBox={`0 0 ${largura} ${altura}`} className="grafico-linha-svg" preserveAspectRatio="none">
          {niveisY.map((nivel) => {
            const y = margem.topo + (nivel / 4) * alturaGrafico;
            return <line key={`g-${nivel}`} x1={margem.esquerda} y1={y} x2={largura - margem.direita} y2={y} className="grafico-linha-grade" />;
          })}
          <line
            x1={margem.esquerda}
            y1={margem.topo}
            x2={margem.esquerda}
            y2={margem.topo + alturaGrafico}
            className="grafico-linha-eixo"
          />
          <line
            x1={margem.esquerda}
            y1={margem.topo + alturaGrafico}
            x2={largura - margem.direita}
            y2={margem.topo + alturaGrafico}
            className="grafico-linha-eixo"
          />

          <path d={caminhoArea} className="grafico-linha-area" />
          <path d={caminhoLinha} className="grafico-linha-traco" />

          {pontosComMarcador.map((ponto, indice) => (
            <circle key={`p-${indice}-${ponto.x}`} cx={ponto.x} cy={ponto.y} r="4.2" className="grafico-linha-ponto" />
          ))}

          {labels.map((ponto) => (
            <text key={`l-${ponto.x}`} x={ponto.x} y={altura - 12} textAnchor="middle" className="grafico-linha-label-x">
              {ponto.etiqueta}
            </text>
          ))}

          {niveisY.map((nivel) => {
            const y = margem.topo + (nivel / 4) * alturaGrafico;
            const valorTick = maximo * ((4 - nivel) / 4);
            return (
              <text
                key={`y-${nivel}`}
                x={margem.esquerda - 10}
                y={y + 4}
                textAnchor="end"
                className="grafico-linha-label-y"
              >
                {formatarEuroEixo(valorTick)}
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function PieVendidoVsStock({ resumo }) {
  const vendido = Math.max(0, Number(resumo?.faturacao_total ?? 0));
  const porVender = Math.max(0, Number(resumo?.valor_em_stock ?? 0));
  const total = vendido + porVender;

  if (total <= 0) {
    return (
      <section className="dashboard-bloco dashboard-bloco-grafico">
        <div className="dashboard-bloco-topo">
          <h2>Vendido vs por vender</h2>
        </div>
        <p className="estado">Ainda não há valores suficientes para este gráfico.</p>
      </section>
    );
  }

  const percentagemVendido = (vendido / total) * 100;
  const estiloPie = {
    background: `conic-gradient(from -90deg, #2da56c 0 ${percentagemVendido}%, #cfd6df ${percentagemVendido}% 100%)`,
  };

  return (
    <section className="dashboard-bloco dashboard-bloco-grafico">
      <div className="dashboard-bloco-topo">
        <h2>Vendido vs por vender</h2>
      </div>

      <div className="dashboard-pie-layout">
        <div className="dashboard-pie" style={estiloPie} aria-label="Percentagem em euros de vendido e por vender">
          <div className="dashboard-pie-centro">
            <span>Total</span>
            <strong>{formatarEuro(total)}</strong>
          </div>
        </div>

        <div className="dashboard-pie-legenda">
          <div className="dashboard-pie-item">
            <span className="swatch swatch-vendido" />
            <div className="dashboard-pie-item-texto">
              <strong>Vendido</strong>
              <span>{formatarEuro(vendido)} ({percentagemVendido.toFixed(1)}%)</span>
            </div>
          </div>
          <div className="dashboard-pie-item">
            <span className="swatch swatch-stock" />
            <div className="dashboard-pie-item-texto">
              <strong>Por vender</strong>
              <span>{formatarEuro(porVender)} ({(100 - percentagemVendido).toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function DashboardVendas({
  dashboard,
  loading,
  operacaoVendaHistoricoId = null,
  onAtualizarVendaHistorico,
  onEliminarVendaHistorico,
}) {
  const resumo = dashboard?.resumo || {
    faturacao_total: 0,
    valor_em_stock: 0,
    unidades_vendidas: 0,
    unidades_em_stock: 0,
  };
  const historico = dashboard?.historico || [];

  const [mesesVisiveis, setMesesVisiveis] = useState(6);
  const [editandoId, setEditandoId] = useState(null);
  const [draftVenda, setDraftVenda] = useState({ quantidade_vendida: 1, preco_unitario: 0 });

  const serieTemporal = useMemo(
    () => obterSerieTemporal(historico, mesesVisiveis),
    [historico, mesesVisiveis],
  );

  if (loading) {
    return (
      <section className="painel painel-dashboard">
        <p className="estado">A carregar dashboard de vendas...</p>
      </section>
    );
  }

  const iniciarEdicaoVenda = (venda) => {
    setEditandoId(venda.id);
    setDraftVenda({
      quantidade_vendida: Math.max(1, Number(venda.quantidade_vendida ?? 1)),
      preco_unitario: Math.max(0, Number(venda.preco_unitario ?? 0)),
    });
  };

  const cancelarEdicaoVenda = () => {
    setEditandoId(null);
    setDraftVenda({ quantidade_vendida: 1, preco_unitario: 0 });
  };

  const guardarEdicaoVenda = async (venda) => {
    if (typeof onAtualizarVendaHistorico !== "function") {
      return;
    }

    const payload = {
      quantidade_vendida: Math.max(1, Number(draftVenda.quantidade_vendida ?? 1)),
      preco_unitario: Math.max(0, Number(draftVenda.preco_unitario ?? 0)),
    };

    const sucesso = await onAtualizarVendaHistorico(venda, payload);
    if (sucesso) {
      cancelarEdicaoVenda();
    }
  };

  return (
    <section className="painel painel-dashboard">
      <div className="dashboard-graficos dashboard-graficos-duplo">
        <div className="dashboard-grafico-com-filtros">
          <div className="dashboard-filtros-grafico">
            <h2 className="dashboard-titulo-grafico">Vendas ao longo do tempo</h2>
            <label className="dashboard-filtro-janela">
              <select
                aria-label="Janela temporal"
                value={mesesVisiveis}
                onChange={(event) => setMesesVisiveis(Number(event.target.value))}
              >
                <option value={3}>Últimos 3 meses</option>
                <option value={6}>Últimos 6 meses</option>
                <option value={12}>Últimos 12 meses</option>
                <option value={24}>Últimos 24 meses</option>
                <option value={0}>Todo o histórico</option>
              </select>
            </label>
          </div>

          <GraficoLinhaTemporal serie={serieTemporal} />
        </div>

        <PieVendidoVsStock resumo={resumo} />
      </div>

      <section className="dashboard-bloco dashboard-bloco-historico">
        <div className="dashboard-bloco-topo">
          <h2>Histórico de vendas</h2>
          <span>{formatarInteiro(historico.length)} registos</span>
        </div>

        {!historico.length ? (
          <p className="estado">Ainda não há vendas registadas.</p>
        ) : (
          <div className="dashboard-tabela-wrapper">
            <table className="dashboard-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Referência</th>
                  <th>Designação</th>
                  <th>Categoria</th>
                  <th>Qtd.</th>
                  <th>Total</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((venda) => {
                  const emEdicao = editandoId === venda.id;
                  const emOperacao = operacaoVendaHistoricoId === venda.id;

                  return (
                    <tr key={venda.id}>
                      <td>{formatarDataHora(venda.vendida_em)}</td>
                      <td>{venda.referencia || "-"}</td>
                      <td>{venda.designacao || "-"}</td>
                      <td>{venda.categoria || "-"}</td>
                      <td>
                        {emEdicao ? (
                          <div className="quantidade-box">
                            <button
                              type="button"
                              className="botao-quantidade"
                              disabled={emOperacao || Number(draftVenda.quantidade_vendida ?? 1) <= 1}
                              onClick={() =>
                                setDraftVenda((anterior) => ({
                                  ...anterior,
                                  quantidade_vendida: Math.max(1, Number(anterior.quantidade_vendida ?? 1) - 1),
                                }))
                              }
                            >
                              -
                            </button>
                            <span>{Math.max(1, Number(draftVenda.quantidade_vendida ?? 1))}</span>
                            <button
                              type="button"
                              className="botao-quantidade"
                              disabled={emOperacao}
                              onClick={() =>
                                setDraftVenda((anterior) => ({
                                  ...anterior,
                                  quantidade_vendida: Math.max(1, Number(anterior.quantidade_vendida ?? 1) + 1),
                                }))
                              }
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          formatarInteiro(venda.quantidade_vendida)
                        )}
                      </td>
                      <td>
                        {formatarEuro(venda.total_venda)}
                      </td>
                      <td>
                        <div className="acoes-linha acoes-linha-dashboard">
                          {emEdicao ? (
                            <>
                              <button
                                type="button"
                                className="botao-acao botao-guardar"
                                onClick={() => guardarEdicaoVenda(venda)}
                                disabled={emOperacao}
                                title="Guardar venda"
                              >
                                <IconeGuardar />
                              </button>
                              <button
                                type="button"
                                className="botao-acao botao-cancelar"
                                onClick={cancelarEdicaoVenda}
                                disabled={emOperacao}
                                title="Cancelar edição"
                              >
                                <IconeCancelar />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="botao-acao botao-editar"
                                onClick={() => iniciarEdicaoVenda(venda)}
                                disabled={emOperacao}
                                title="Editar venda"
                              >
                                <IconeEditar />
                              </button>
                              <button
                                type="button"
                                className="botao-acao botao-eliminar"
                                onClick={() => onEliminarVendaHistorico?.(venda)}
                                disabled={emOperacao}
                                title="Eliminar registo"
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
        )}
      </section>
    </section>
  );
}
