import React from "react";
import { Badge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { MetricCard } from "../../../shared/components/Feedback";
import { Skeleton } from "../../../shared/components/Feedback";
import { EmptyState } from "../../../shared/components/Feedback";
import { PlotlyRenderer } from "./PlotlyRenderer";

export function ReporteR1StockView({
  r1Data,
  loadingR1,
  r1Items,
  r1Resumen,
  openR1DrillDown,
  setR1UbicacionId,
  setR1CategoriaId,
  setR1SoloBajoMinimo,
}) {
  const tieneDesvios = (r1Resumen?.total_items_criticos ?? 0) > 0;

  return (
    <div className="stack gap-4">
      {/* 1. Tira de Métricas Clave Operacionales */}
      <div className="stocky-kpi-grid">
        <MetricCard
          label="Valorización Inventario (Costo)"
          value={
            loadingR1 ? (
              <Skeleton width={110} height={28} />
            ) : (
              `$${(r1Resumen?.total_valorizado_costo ?? 0).toLocaleString("es-AR")}`
            )
          }
          subtext="Suma total (disponible x costo unitario)"
          badgeText="Patrimonio Red"
          badgeTone="info"
        />

        <MetricCard
          label="Valorización Potencial (Venta)"
          value={
            loadingR1 ? (
              <Skeleton width={110} height={28} />
            ) : (
              `$${(r1Resumen?.total_valorizado_venta ?? 0).toLocaleString("es-AR")}`
            )
          }
          subtext={`Margen proyectado: $${(r1Resumen?.margen_total_potencial ?? 0).toLocaleString("es-AR")}`}
          badgeText="Precio Venta"
          badgeTone="success"
        />

        <MetricCard
          label="Unidades Físicas en Red"
          value={
            loadingR1 ? (
              <Skeleton width={70} height={28} />
            ) : (
              (r1Resumen?.total_existencias ?? 0).toLocaleString("es-AR")
            )
          }
          subtext={`${r1Resumen?.total_unidades_disponibles ?? 0} disp. · ${r1Resumen?.total_unidades_en_transito ?? 0} en tránsito`}
          badgeText="Existencias"
          badgeTone="neutral"
        />

        <MetricCard
          label="Alertas Stock Crítico (Observer)"
          value={
            loadingR1 ? (
              <Skeleton width={50} height={28} />
            ) : (
              r1Resumen?.total_items_criticos ?? 0
            )
          }
          subtext="Artículos en o bajo nivel mínimo"
          badgeText={tieneDesvios ? "Atención Requerida" : "Saludable"}
          badgeTone={tieneDesvios ? "danger" : "success"}
        />
      </div>

      {/* 2. Hallazgos Operacionales y Acciones Inmediatas (Priorizado antes que gráficos) */}
      <div className="stocky-formal-dictamen-panel">
        <div className="row justify-between align-center wrap gap-2">
          <div>
            <div className="stocky-formal-dictamen-title">
              {tieneDesvios
                ? "Hallazgo operacional: Desvío en cobertura de stock de seguridad"
                : "Hallazgo operacional: Existencias equilibradas en la red"}
            </div>
            <div className="stocky-formal-dictamen-body">
              {tieneDesvios
                ? `El monitor Observer identificó ${r1Resumen?.total_items_criticos} artículo(s) que han alcanzado o perforado su nivel mínimo de existencia. Se requiere emitir reposición desde el CD Central para evitar quiebres en los puntos de venta.`
                : "Todos los artículos evaluados se encuentran por encima del umbral mínimo de seguridad. No se registran riesgos inminentes de rotura de inventario."}
            </div>
          </div>

          {tieneDesvios && (
            <div className="no-print">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setR1SoloBajoMinimo(true)}
              >
                Filtrar solo artículos bajo mínimo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Tabla Detallada de Existencias y Valorización (Priorizada) */}
      <div className="erp-table-card">
        <div className="p-3 border-b border-subtle row justify-between align-center">
          <div>
            <h3 className="erp-card-title">
              Detalle de Existencias Físicas y Valorización por Nodo
            </h3>
            <p className="text-xs text-secondary">
              Haz clic en cualquier fila o en "Ficha Stock" para abrir el drill-down comparativo multisede.
            </p>
          </div>
          <Badge tone="info">{r1Items.length} registros</Badge>
        </div>

        {loadingR1 ? (
          <div className="p-4 stack gap-2">
            <Skeleton height={32} />
            <Skeleton height={32} />
            <Skeleton height={32} />
          </div>
        ) : r1Items.length === 0 ? (
          <EmptyState
            title="No se encontraron artículos"
            description="Ningún registro coincide con los filtros de ubicación, categoría o stock crítico."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setR1UbicacionId("");
                  setR1CategoriaId("");
                  setR1SoloBajoMinimo(false);
                }}
              >
                Restablecer filtros
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table stocky-report-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Ubicación</th>
                  <th>Tipo</th>
                  <th className="text-right">Disponible</th>
                  <th className="text-right">Tránsito</th>
                  <th className="text-right">Mínimo</th>
                  <th>Estado</th>
                  <th className="text-right">Val. Costo</th>
                  <th className="text-right">Val. Venta</th>
                  <th className="text-right no-print">Acción</th>
                </tr>
              </thead>
              <tbody>
                {r1Items.map((item, idx) => (
                  <tr
                    key={`${item.producto_id}-${item.ubicacion_id}-${idx}`}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => openR1DrillDown(item.producto_id)}
                    title="Haz clic para abrir Ficha Multisede"
                  >
                    <td className="font-mono text-xs font-medium">{item.producto_codigo}</td>
                    <td className="font-medium">{item.producto_nombre}</td>
                    <td className="text-xs text-secondary">{item.categoria_nombre}</td>
                    <td className="text-xs">{item.ubicacion_nombre}</td>
                    <td>
                      <Badge tone={item.ubicacion_tipo === "CD" ? "neutral" : "info"}>
                        {item.ubicacion_tipo}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums font-mono">{item.cantidad_disponible}</td>
                    <td className="text-right tabular-nums font-mono text-secondary">
                      {item.cantidad_en_transito}
                    </td>
                    <td className="text-right tabular-nums font-mono text-muted">
                      {item.nivel_minimo_existencia}
                    </td>
                    <td>
                      <Badge
                        tone={
                          item.estado_stock === "CRITICO"
                            ? "danger"
                            : item.estado_stock === "ADVERTENCIA"
                            ? "warning"
                            : "success"
                        }
                      >
                        {item.estado_stock}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      ${item.valorizacion_costo?.toLocaleString("es-AR")}
                    </td>
                    <td className="text-right tabular-nums text-secondary">
                      ${item.valorizacion_venta?.toLocaleString("es-AR")}
                    </td>
                    <td className="text-right no-print" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openR1DrillDown(item.producto_id)}
                      >
                        Ficha Stock
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Visualizaciones Analíticas Secundarias (Debajo de la tabla operativa) */}
      <div className="border-t border-subtle pt-4">
        <div className="mb-3">
          <h4 className="text-sm font-medium text-secondary">
            Visualizaciones Analíticas Secundarias
          </h4>
          <p className="text-xs text-muted">
            Gráficos de apoyo para análisis de distribución y concentración de capital inmovilizado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlotlyRenderer
            figure={r1Data?.grafico_valorizacion_por_ubicacion}
            title="Valorización de Inventario por Ubicación Física"
            subtitle="Comparativa agrupada de capital inmovilizado a costo vs precio de venta"
            badgeText="CD Central vs Locales"
          />

          <PlotlyRenderer
            figure={r1Data?.grafico_distribucion_stock}
            title="Distribución de Artículos según Salud de Stock"
            subtitle="Proporción de existencias en estado óptimo, advertencia y crítico (Observer)"
            badgeText="Salud de Red"
          />
        </div>
      </div>
    </div>
  );
}

export default ReporteR1StockView;
