import React, { useState } from "react";
import { Badge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { Icon } from "../../../shared/components/Icon";
import { Modal } from "../../../shared/components/Motion";
import { PlotlyRenderer } from "./PlotlyRenderer";

const ESTADOS_STEPPER = [
  { key: "PREPARADO", label: "Preparado (CD)", icon: "package" },
  { key: "PRECINTADO", label: "Precintado", icon: "lock" },
  { key: "EN_TRANSITO", label: "En Tránsito", icon: "truck" },
  { key: "RECIBIDO", label: "Recibido (Local)", icon: "store" },
  { key: "RECHAZADO", label: "Rechazado (Merma)", icon: "shield-off" },
];

export function ModalAuditoriaMerma({ open, onClose, bultoId, data, loading }) {
  const [activeTab, setActiveTab] = useState("dictamen"); // "dictamen" | "patrimonial" | "trazabilidad"

  const lineaTiempo = data?.linea_de_tiempo || [];
  const detallesProductos = data?.detalles_productos || [];

  // Mapear cada estado del stepper con la bitácora real
  const mappedSteps = ESTADOS_STEPPER.map((step, idx) => {
    const evento = lineaTiempo.find((h) => h.estado_nuevo === step.key);
    const isRejected = step.key === "RECHAZADO";
    const isCompleted = !!evento && !isRejected;

    return {
      ...step,
      stepNumber: idx + 1,
      evento,
      isCompleted,
      isRejected,
      timestamp: evento?.fecha_hora
        ? new Date(evento.fecha_hora).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
      dateFormatted: evento?.fecha_hora
        ? new Date(evento.fecha_hora).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
          })
        : null,
    };
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      ariaLabel={`Auditoría Forense Bulto ${data?.bulto_id || bultoId}`}
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
                  Auditoría Forense · Bulto #{data?.bulto_id || bultoId}
                </h2>
                <Badge tone="danger">RECHAZO POR MERMA (V1)</Badge>
                {data?.remito_numero && (
                  <Badge tone="neutral" dot={false}>
                    Remito: {data.remito_numero}
                  </Badge>
                )}
              </div>
              <p className="stocky-modal-subtitle">
                Orden de Reposición: <strong>#{data?.orden_id || "N/A"}</strong> · Origen:{" "}
                <strong>{data?.origen?.nombre || "CD Central"}</strong> ➔ Destino:{" "}
                <strong>{data?.destino?.nombre || "Local Comercial"}</strong>
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar modal">
            <Icon name="x" size={16} />
          </Button>
        </header>
      }
      nav={
        <>
          <div className="p-4 bg-muted border-b border-subtle">
            <div className="stocky-stepper-wrap">
              <div className="row justify-between align-center mb-2">
                <span className="stocky-stepper-title">
                  Cadena de Custodia Inmutable (Historial_Bulto)
                </span>
                <span className="text-xs text-muted">
                  Auditado por: <strong>Martín Gómez (Perito Logístico)</strong>
                </span>
              </div>

              <div className="stocky-stepper">
                {mappedSteps.map((s, idx) => (
                  <div
                    key={s.key}
                    className={`stocky-step ${s.isCompleted ? "is-completed" : ""} ${
                      s.isRejected ? "is-rejected" : ""
                    } ${idx === mappedSteps.length - 2 ? "is-danger-line" : ""}`}
                  >
                    {idx < mappedSteps.length - 1 && <span className="stocky-step-line" />}
                    <div className="stocky-step-node" title={s.label}>
                      {s.isRejected ? (
                        <Icon name="shield-off" size={16} />
                      ) : s.isCompleted ? (
                        <Icon name="check" size={14} />
                      ) : (
                        <span>{s.stepNumber}</span>
                      )}
                    </div>
                    <span className="stocky-step-label">{s.label}</span>
                    {s.timestamp && (
                      <span className="stocky-step-time">
                        {s.dateFormatted} · {s.timestamp}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <nav className="stocky-modal-nav" role="tablist" aria-label="Secciones de la auditoría forense">
            <button
              type="button"
              role="tab"
              id="tab-auditoria-dictamen"
              aria-selected={activeTab === "dictamen"}
              aria-controls="panel-auditoria-dictamen"
              className={`stocky-modal-tab-btn ${activeTab === "dictamen" ? "is-active" : ""}`}
              onClick={() => setActiveTab("dictamen")}
            >
              <Icon name="lock" size={14} />
              <span>Dictamen Forense & Precinto</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-auditoria-patrimonial"
              aria-selected={activeTab === "patrimonial"}
              aria-controls="panel-auditoria-patrimonial"
              className={`stocky-modal-tab-btn ${activeTab === "patrimonial" ? "is-active" : ""}`}
              onClick={() => setActiveTab("patrimonial")}
            >
              <Icon name="cash" size={14} />
              <span>Valorización Patrimonial</span>
              {data?.total_unidades_merma > 0 && (
                <Badge tone="danger" dot={false}>
                  {data.total_unidades_merma} unidades
                </Badge>
              )}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-auditoria-trazabilidad"
              aria-selected={activeTab === "trazabilidad"}
              aria-controls="panel-auditoria-trazabilidad"
              className={`stocky-modal-tab-btn ${activeTab === "trazabilidad" ? "is-active" : ""}`}
              onClick={() => setActiveTab("trazabilidad")}
            >
              <Icon name="chart" size={14} />
              <span>Bitácora Inmutable & Gráfico</span>
            </button>
          </nav>
        </>
      }
      footer={
        <div className="row justify-between align-center w-full">
          <span className="text-xs text-secondary">
            Peritaje cerrado y registrado en base forense Stocky · Acta Nº {data?.bulto_id || bultoId}-2026
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar Peritaje
          </Button>
        </div>
      }
    >
          {loading ? (
            <div className="stack align-center justify-center p-8 gap-3">
              <span className="text-secondary">Extrayendo evidencia pericial y trazabilidad...</span>
            </div>
          ) : (
            <>
              {/* KPIs de la Pérdida */}
              <div className="stocky-kpi-grid">
                <div className="erp-metric-card">
                  <span className="text-xs text-muted">Unidades Rechazadas</span>
                  <div className="erp-metric-card__value text-danger">
                    {data?.total_unidades_merma ?? 0}
                  </div>
                  <span className="text-xs text-secondary">
                    Total damnificado en bulto
                  </span>
                </div>
                <div className="erp-metric-card">
                  <span className="text-xs text-muted">Pérdida a Costo (Patrimonial)</span>
                  <div className="erp-metric-card__value text-danger">
                    ${(data?.costo_total_merma ?? 0).toLocaleString("es-AR")}
                  </div>
                  <span className="text-xs text-secondary">
                    Impacto directo en inventario
                  </span>
                </div>
                <div className="erp-metric-card">
                  <span className="text-xs text-muted">Pérdida a Precio de Venta</span>
                  <div className="erp-metric-card__value">
                    ${(data?.valor_venta_merma ?? 0).toLocaleString("es-AR")}
                  </div>
                  <span className="text-xs text-secondary">
                    Ingreso frustrado en caja
                  </span>
                </div>
              </div>

              {/* Tab 1: Dictamen Forense & Precinto */}
              {activeTab === "dictamen" && (
                <div
                  role="tabpanel"
                  id="panel-auditoria-dictamen"
                  aria-labelledby="tab-auditoria-dictamen"
                  className="stack gap-4"
                >
                  {/* Tarjeta del Dictamen Forense */}
                  <div className="stocky-dictamen-card">
                    <div className="stocky-dictamen-header">
                      <Icon name="shield-off" size={18} />
                      <span>Dictamen Técnico Pericial de Seguridad</span>
                    </div>
                    <pre className="stocky-dictamen-text">
                      {data?.dictamen_forense || data?.motivo_rechazo}
                    </pre>
                  </div>

                  {/* Detalle de Inspección de Precinto */}
                  <div className="stocky-precinto-card">
                    <div>
                      <span className="text-xs text-muted">Código de Precinto</span>
                      <div className="font-mono font-medium text-sm text-foreground">
                        {data?.codigo_precinto || "SIN_PRECINTO"}
                      </div>
                      <span className="text-xs text-secondary">Faja numerada en CD</span>
                    </div>

                    <div>
                      <span className="text-xs text-muted">Integridad Física</span>
                      <div>
                        {data?.precinto_intacto ? (
                          <Badge tone="success">Precinto Intacto</Badge>
                        ) : (
                          <Badge tone="danger">VIOLADO / ADULTERADO</Badge>
                        )}
                      </div>
                      <span className="text-xs text-secondary">Control P6 en Destino</span>
                    </div>

                    <div>
                      <span className="text-xs text-muted">Resolución del Sistema</span>
                      <div className="font-medium text-xs text-danger">
                        Regla V1: Merma Irrevocable
                      </div>
                      <span className="text-xs text-secondary">
                        Bloqueo de ingreso a stock vendible
                      </span>
                    </div>
                  </div>

                  {/* Nodos Logísticos de la Ruta Troncal */}
                  <div className="erp-table-card p-4">
                    <div className="text-xs font-medium text-secondary mb-3">
                      Ruta Troncal de Custodia
                    </div>
                    <div className="row justify-between gap-4 wrap">
                      <div>
                        <div className="text-xs text-muted">Origen de Carga:</div>
                        <div className="font-medium text-xs">{data?.origen?.nombre}</div>
                        <div className="text-xs text-secondary">{data?.origen?.direccion}</div>
                        {data?.origen?.telefono && (
                          <div className="text-xs text-muted">Tel: {data?.origen?.telefono}</div>
                        )}
                      </div>

                      <div className="row align-center text-muted">
                        <Icon name="arrow-right" size={16} />
                      </div>

                      <div>
                        <div className="text-xs text-muted">Destino de Recepción:</div>
                        <div className="font-medium text-xs">{data?.destino?.nombre}</div>
                        <div className="text-xs text-secondary">{data?.destino?.direccion}</div>
                        {data?.destino?.telefono && (
                          <div className="text-xs text-muted">Tel: {data?.destino?.telefono}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Valorización Patrimonial */}
              {activeTab === "patrimonial" && (
                <div
                  role="tabpanel"
                  id="panel-auditoria-patrimonial"
                  aria-labelledby="tab-auditoria-patrimonial"
                  className="stack gap-4"
                >
                  <div className="erp-table-card">
                    <div className="p-3 border-b border-subtle row justify-between align-center">
                      <span className="font-medium text-xs">
                        Desglose de Artículos Damnificados en Bulto #{data?.bulto_id}
                      </span>
                      <span className="text-xs text-muted">
                        Costos y pérdidas unitarias y totales
                      </span>
                    </div>

                    <table className="erp-table stocky-report-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Producto</th>
                          <th className="text-right">Cant. Damnificada</th>
                          <th className="text-right">Costo Unitario</th>
                          <th className="text-right">Pérdida Costo Total</th>
                          <th className="text-right">Precio Venta</th>
                          <th className="text-right">Pérdida Venta Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detallesProductos.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center p-4 text-muted">
                              Sin detalle individual de artículos en la merma.
                            </td>
                          </tr>
                        ) : (
                          detallesProductos.map((p, idx) => (
                            <tr key={idx}>
                              <td className="font-mono text-xs">{p.producto_codigo}</td>
                              <td className="font-medium">{p.producto_nombre}</td>
                              <td className="text-right tabular-nums text-danger font-medium">
                                -{p.cantidad} un.
                              </td>
                              <td className="text-right tabular-nums">
                                ${p.costo_unitario?.toLocaleString("es-AR")}
                              </td>
                              <td className="text-right tabular-nums font-medium text-danger">
                                ${p.perdida_costo?.toLocaleString("es-AR")}
                              </td>
                              <td className="text-right tabular-nums">
                                ${p.precio_venta?.toLocaleString("es-AR")}
                              </td>
                              <td className="text-right tabular-nums font-medium">
                                ${p.perdida_venta?.toLocaleString("es-AR")}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="2" className="font-medium">
                            Total General Damnificado
                          </td>
                          <td className="text-right font-medium text-danger tabular-nums">
                            -{data?.total_unidades_merma ?? 0} un.
                          </td>
                          <td className="text-right text-muted">-</td>
                          <td className="text-right font-medium text-danger tabular-nums">
                            ${(data?.costo_total_merma ?? 0).toLocaleString("es-AR")}
                          </td>
                          <td className="text-right text-muted">-</td>
                          <td className="text-right font-medium tabular-nums">
                            ${(data?.valor_venta_merma ?? 0).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Bitácora Inmutable & Gráfico */}
              {activeTab === "trazabilidad" && (
                <div
                  role="tabpanel"
                  id="panel-auditoria-trazabilidad"
                  aria-labelledby="tab-auditoria-trazabilidad"
                  className="stack gap-4"
                >
                  {/* Bitácora de Trazabilidad */}
                  <div className="erp-table-card">
                    <div className="p-3 border-b border-subtle">
                      <span className="font-medium text-xs">
                        Bitácora Cronológica de Trazabilidad Inmutable
                      </span>
                    </div>
                    <table className="erp-table stocky-report-table">
                      <thead>
                        <tr>
                          <th>Hito</th>
                          <th>Transición de Estado</th>
                          <th>Fecha y Hora</th>
                          <th>Observación Forense</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineaTiempo.map((h) => (
                          <tr key={h.id}>
                            <td className="font-mono text-xs">#{h.id}</td>
                            <td>
                              <div className="row align-center gap-1 font-mono text-xs">
                                <span>{h.estado_anterior}</span>
                                <span>➔</span>
                                <strong
                                  className={
                                    h.estado_nuevo === "RECHAZADO"
                                      ? "text-danger"
                                      : "text-foreground"
                                  }
                                >
                                  {h.estado_nuevo}
                                </strong>
                              </div>
                            </td>
                            <td className="text-xs tabular-nums text-secondary whitespace-nowrap">
                              {new Date(h.fecha_hora).toLocaleString("es-AR")}
                            </td>
                            <td className="text-xs text-secondary">{h.observacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {data?.grafico_perdida_por_producto && (
                    <PlotlyRenderer
                      figure={data.grafico_perdida_por_producto}
                      height={260}
                      title="Pérdida por Artículo Damnificado"
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
