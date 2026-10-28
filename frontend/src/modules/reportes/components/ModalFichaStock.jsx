import React, { useState } from "react";
import { Badge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { Icon } from "../../../shared/components/Icon";
import { Modal } from "../../../shared/components/Motion";
import { PlotlyRenderer } from "./PlotlyRenderer";

export function ModalFichaStock({ open, onClose, productoId, data, loading }) {
  const [activeTab, setActiveTab] = useState("multisede"); // "multisede" | "reposicion" | "alertas"

  const desglose = data?.desglose_por_ubicacion || [];
  const cdNode = desglose.find((n) => n.ubicacion_tipo === "CD");
  const localNodes = desglose.filter((n) => n.ubicacion_tipo === "LOCAL");

  // Cálculo de reposición requerida en toda la red de locales
  const reposicionGlobal = localNodes.map((local) => {
    const min = local.nivel_minimo_existencia || 0;
    const disp = local.cantidad_disponible || 0;
    // Fórmula requerida: ((min * 2) - disp)
    const calculo = min * 2 - disp;
    const sugerido = Math.max(0, calculo);
    const urgencia =
      disp <= min ? "URGENTE" : disp < min * 2 ? "NORMAL" : "OPTIMO";

    return {
      ...local,
      stockObjetivo: min * 2,
      sugerido,
      urgencia,
    };
  });

  const totalSugeridoLocales = reposicionGlobal.reduce(
    (acc, cur) => acc + cur.sugerido,
    0
  );
  const cdDisponible = cdNode?.cantidad_disponible || 0;
  const cdCubreRequerimiento = cdDisponible >= totalSugeridoLocales;

  // Alertas del Observer
  const observerAlerts = desglose
    .filter((n) => n.estado_stock === "CRITICO" || n.faltante > 0)
    .map((n) => ({
      ubicacion: n.ubicacion_nombre,
      tipo: n.ubicacion_tipo,
      disponible: n.cantidad_disponible,
      minimo: n.nivel_minimo_existencia,
      faltante: n.faltante,
      mensaje: `Alerta del Observer: ${n.ubicacion_nombre} se encuentra por debajo del stock mínimo (${n.cantidad_disponible} disp. vs ${n.nivel_minimo_existencia} mín.). Déficit detectado: ${n.faltante} unidades.`,
    }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      ariaLabel={`Ficha Multisede SKU ${data?.producto_codigo || productoId}`}
      header={
        <header className="arc-modal__header stocky-modal-header">
          <div className="stocky-modal-header-brand">
            <img
              src="/brand/stocky-logo.png"
              alt="Stocky Logo"
              className="stocky-modal-logo"
            />
            <div>
              <div className="row align-center gap-2">
                <h2 className="stocky-modal-title">
                  Ficha Multisede & Reposición · SKU: {data?.producto_codigo || `ID #${productoId}`}
                </h2>
                {data?.estado_global && (
                  <Badge
                    tone={
                      data.estado_global === "CRITICO"
                        ? "danger"
                        : data.estado_global === "ADVERTENCIA"
                        ? "warning"
                        : "success"
                    }
                  >
                    Red: {data.estado_global}
                  </Badge>
                )}
              </div>
              <p className="stocky-modal-subtitle">
                {data?.producto_nombre || "Cargando detalle de producto..."} · Categoría:{" "}
                <strong>{data?.categoria_nombre || "General"}</strong>
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar modal">
            <Icon name="x" size={16} />
          </Button>
        </header>
      }
      nav={
        <nav className="stocky-modal-nav" role="tablist" aria-label="Secciones de la ficha de stock">
          <button
            type="button"
            role="tab"
            id="tab-ficha-multisede"
            aria-selected={activeTab === "multisede"}
            aria-controls="panel-ficha-multisede"
            className={`stocky-modal-tab-btn ${activeTab === "multisede" ? "is-active" : ""}`}
            onClick={() => setActiveTab("multisede")}
          >
            <Icon name="warehouse" size={14} />
            <span>Ficha Multisede (CD vs Locales)</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-ficha-reposicion"
            aria-selected={activeTab === "reposicion"}
            aria-controls="panel-ficha-reposicion"
            className={`stocky-modal-tab-btn ${activeTab === "reposicion" ? "is-active" : ""}`}
            onClick={() => setActiveTab("reposicion")}
          >
            <Icon name="truck" size={14} />
            <span>Proyección de Reposición Sugerida</span>
            {totalSugeridoLocales > 0 && (
              <Badge tone="warning" dot={false}>
                +{totalSugeridoLocales} un.
              </Badge>
            )}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-ficha-alertas"
            aria-selected={activeTab === "alertas"}
            aria-controls="panel-ficha-alertas"
            className={`stocky-modal-tab-btn ${activeTab === "alertas" ? "is-active" : ""}`}
            onClick={() => setActiveTab("alertas")}
          >
            <Icon name="alert-triangle" size={14} />
            <span>Alertas Observer & Gráfico</span>
            {observerAlerts.length > 0 && (
              <Badge tone="danger" dot={false}>
                {observerAlerts.length}
              </Badge>
            )}
          </button>
        </nav>
      }
      footer={
        <div className="row justify-between align-center w-full">
          <span className="text-xs text-secondary">
            Stocky Auditoría · Consulta multisede sincronizada
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar Ficha
          </Button>
        </div>
      }
    >
          {loading ? (
            <div className="stack align-center justify-center p-8 gap-3">
              <span className="text-secondary">Consultando estado multisede en tiempo real...</span>
            </div>
          ) : (
            <>
              {/* Tira de KPIs resumidos */}
              <div className="stocky-kpi-grid">
                <div className="erp-metric-card">
                  <span className="text-xs text-muted">Total Disponible Red</span>
                  <div className="erp-metric-card__value">{data?.total_disponible_red ?? 0}</div>
                  <span className="text-xs text-secondary">
                    En tránsito: <strong>{data?.total_transito_red ?? 0}</strong>
                  </span>
                </div>
                <div className="erp-metric-card">
                  <span className="text-xs text-muted">Costo Unitario</span>
                  <div className="erp-metric-card__value">
                    ${(data?.costo_unitario ?? 0).toLocaleString("es-AR")}
                  </div>
                  <span className="text-xs text-secondary">
                    Venta: ${(data?.precio_venta ?? 0).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="erp-metric-card">
                  <span className="text-xs text-muted">Valorizado Total (Costo)</span>
                  <div className="erp-metric-card__value text-success">
                    ${(data?.total_valorizado_costo_red ?? 0).toLocaleString("es-AR")}
                  </div>
                  <span className="text-xs text-secondary">
                    Venta: ${(data?.total_valorizado_venta_red ?? 0).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Tab 1: Ficha Multisede Comparativa */}
              {activeTab === "multisede" && (
                <div
                  role="tabpanel"
                  id="panel-ficha-multisede"
                  aria-labelledby="tab-ficha-multisede"
                  className="stack gap-4"
                >
                  {/* Cobertura del CD Central */}
                  <div className="stocky-formula-banner">
                    <div className="row align-center gap-3">
                      <Icon name="warehouse" size={18} />
                      <div>
                        <div className="font-medium text-xs">
                          Capacidad de Despacho del Centro de Distribución Central:
                        </div>
                        <div className="text-xs text-secondary">
                          Stock en nave CD: <strong>{cdDisponible}</strong> un. · Demanda de reposición en locales:{" "}
                          <strong>{totalSugeridoLocales}</strong> un.
                        </div>
                      </div>
                    </div>
                    <Badge tone={cdCubreRequerimiento ? "success" : "danger"}>
                      {cdCubreRequerimiento
                        ? "CD Abastece Red (+100%)"
                        : "Déficit Global en CD"}
                    </Badge>
                  </div>

                  {/* Tabla Comparativa */}
                  <div className="erp-table-card">
                    <table className="erp-table stocky-report-table">
                      <thead>
                        <tr>
                          <th>Nodo Físico</th>
                          <th>Tipo</th>
                          <th className="text-right">Disponible</th>
                          <th className="text-right">En Tránsito</th>
                          <th className="text-right">Total Existencias</th>
                          <th className="text-right">Mínimo</th>
                          <th className="text-right">Faltante</th>
                          <th>Estado Stock</th>
                          <th className="text-right">Valor Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {desglose.map((node) => (
                          <tr key={node.ubicacion_id}>
                            <td className="font-medium">{node.ubicacion_nombre}</td>
                            <td>
                              <span
                                className={`erp-badge ${
                                  node.ubicacion_tipo === "CD"
                                    ? "erp-badge--scope-cd"
                                    : "erp-badge--scope-local"
                                }`}
                              >
                                {node.ubicacion_tipo === "CD" ? "Centro Dist." : "Local Comercial"}
                              </span>
                            </td>
                            <td className="text-right tabular-nums font-medium">
                              {node.cantidad_disponible}
                            </td>
                            <td className="text-right tabular-nums text-secondary">
                              {node.cantidad_en_transito}
                            </td>
                            <td className="text-right tabular-nums">
                              {node.total_existencias}
                            </td>
                            <td className="text-right tabular-nums text-muted">
                              {node.nivel_minimo_existencia}
                            </td>
                            <td className="text-right tabular-nums">
                              {node.faltante > 0 ? (
                                <span className="text-danger font-medium">
                                  -{node.faltante}
                                </span>
                              ) : (
                                <span className="text-muted">0</span>
                              )}
                            </td>
                            <td>
                              <Badge
                                tone={
                                  node.estado_stock === "CRITICO"
                                    ? "danger"
                                    : node.estado_stock === "ADVERTENCIA"
                                    ? "warning"
                                    : "success"
                                }
                              >
                                {node.estado_stock}
                              </Badge>
                            </td>
                            <td className="text-right tabular-nums font-medium">
                              ${node.valorizacion_costo?.toLocaleString("es-AR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Proyección de Reposición Sugerida */}
              {activeTab === "reposicion" && (
                <div
                  role="tabpanel"
                  id="panel-ficha-reposicion"
                  aria-labelledby="tab-ficha-reposicion"
                  className="stack gap-4"
                >
                  <div className="stocky-formula-banner">
                    <div>
                      <div className="font-medium text-xs mb-1">
                        Regla de Reposición Dinámica del Negocio:
                      </div>
                      <div className="stocky-formula-code">
                        Proyección Sugerida = Math.max(0, (Stock_Mínimo × 2) - Stock_Disponible)
                      </div>
                    </div>
                    <span className="text-xs text-secondary max-w-xs text-right">
                      Garantiza buffer de 2 ciclos de venta para cubrir demoras de flete interurbano.
                    </span>
                  </div>

                  <div className="erp-table-card">
                    <table className="erp-table stocky-report-table">
                      <thead>
                        <tr>
                          <th>Local Destino</th>
                          <th className="text-right">Stock Disponible</th>
                          <th className="text-right">Stock Mínimo</th>
                          <th className="text-right">Buffer Objetivo (2x Mín)</th>
                          <th className="text-right">Reposición Sugerida</th>
                          <th>Prioridad</th>
                          <th>Factibilidad CD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reposicionGlobal.map((item) => (
                          <tr key={item.ubicacion_id}>
                            <td className="font-medium">{item.ubicacion_nombre}</td>
                            <td className="text-right tabular-nums font-mono">
                              {item.cantidad_disponible}
                            </td>
                            <td className="text-right tabular-nums text-muted font-mono">
                              {item.nivel_minimo_existencia}
                            </td>
                            <td className="text-right tabular-nums font-mono">
                              {item.stockObjetivo}
                            </td>
                            <td className="text-right tabular-nums font-medium">
                              {item.sugerido > 0 ? (
                                <span className="text-warning">+{item.sugerido} un.</span>
                              ) : (
                                <span className="text-success">0 (Cubierto)</span>
                              )}
                            </td>
                            <td>
                              <Badge
                                tone={
                                  item.urgencia === "URGENTE"
                                    ? "danger"
                                    : item.urgencia === "NORMAL"
                                    ? "warning"
                                    : "success"
                                }
                              >
                                {item.urgencia}
                              </Badge>
                            </td>
                            <td>
                              {item.sugerido === 0 ? (
                                <span className="text-xs text-muted">Stock adecuado</span>
                              ) : cdDisponible >= item.sugerido ? (
                                <span className="text-xs text-success font-medium">
                                  Stock en CD disponible
                                </span>
                              ) : (
                                <span className="text-xs text-danger font-medium">
                                  CD insuficiente para reposición completa
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Alertas del Observer & Gráfico */}
              {activeTab === "alertas" && (
                <div
                  role="tabpanel"
                  id="panel-ficha-alertas"
                  aria-labelledby="tab-ficha-alertas"
                  className="stack gap-4"
                >
                  {observerAlerts.length === 0 ? (
                    <div className="erp-alert erp-alert--success">
                      <div className="row align-center gap-2">
                        <Icon name="shield-check" size={16} />
                        <span className="text-xs font-medium">
                          El Monitor Observer no detectó rupturas de stock en ningún nodo de la red.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="stack gap-2">
                      <div className="text-xs font-medium text-secondary tracking-wider">
                        Notificaciones en Tiempo Real (Patrón Observer)
                      </div>
                      {observerAlerts.map((al, idx) => (
                        <div key={idx} className="stocky-observer-alert">
                          <Icon name="alert-triangle" size={18} />
                          <div>
                            <div className="font-medium text-xs text-danger">
                              {al.ubicacion} (Bajo Mínimo de Existencia)
                            </div>
                            <p className="text-xs text-secondary mt-1">{al.mensaje}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {data?.grafico_stock_por_ubicacion && (
                    <PlotlyRenderer
                      figure={data.grafico_stock_por_ubicacion}
                      height={260}
                      title="Comparativa Gráfica de Existencias por Nodo"
                      badgeText="Plotly Reactivo"
                    />
                  )}
                </div>
              )}
            </>
          )}
    </Modal>
  );
}
