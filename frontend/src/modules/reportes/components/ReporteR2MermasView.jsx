import React from "react";
import { Badge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { MetricCard } from "../../../shared/components/Feedback";
import { Skeleton } from "../../../shared/components/Feedback";
import { EmptyState } from "../../../shared/components/Feedback";
import { PlotlyRenderer } from "./PlotlyRenderer";

export function ReporteR2MermasView({
  r2Data,
  loadingR2,
  r2Bultos,
  r2Resumen,
  openR2DrillDown,
  setR2FechaInicio,
  setR2FechaFin,
  setR2LocalDestinoId,
}) {
  const tieneMermas = (r2Resumen?.total_bultos_rechazados ?? 0) > 0;
  const bultosVioladosCount = r2Bultos.filter((b) => !b.precinto_intacto).length;

  return (
    <div className="stack gap-4">
      {/* 1. Tira de Métricas Clave de Auditoría Forense */}
      <div className="stocky-kpi-grid">
        <MetricCard
          label="Bultos Rechazados (Merma)"
          value={
            loadingR2 ? (
              <Skeleton width={60} height={28} />
            ) : (
              r2Resumen?.total_bultos_rechazados ?? 0
            )
          }
          subtext={`${r2Resumen?.total_unidades_perdidas ?? 0} unidades damnificadas en ruta`}
          badgeText="Regla V1"
          badgeTone="danger"
        />

        <MetricCard
          label="Pérdida Patrimonial (Costo)"
          value={
            loadingR2 ? (
              <Skeleton width={110} height={28} />
            ) : (
              `$${(r2Resumen?.total_costo_merma ?? 0).toLocaleString("es-AR")}`
            )
          }
          subtext="Costo real de mercadería excluida"
          badgeText="No Vendible"
          badgeTone="danger"
        />

        <MetricCard
          label="Lucro Cesante (Venta)"
          value={
            loadingR2 ? (
              <Skeleton width={110} height={28} />
            ) : (
              r2Resumen?.total_valor_venta_merma == null ? "No disponible" : `$${r2Resumen.total_valor_venta_merma.toLocaleString("es-AR")}`
            )
          }
          subtext="No informado por el endpoint de mermas"
          badgeText="Sin dato API"
          badgeTone="warning"
        />

        <MetricCard
          label="Tasa de Rechazo en Destino"
          value={
            loadingR2 ? (
              <Skeleton width={70} height={28} />
            ) : (
              r2Resumen?.tasa_rechazo_porcentaje == null ? "No disponible" : `${r2Resumen.tasa_rechazo_porcentaje}%`
            )
          }
          subtext="El endpoint no calcula una tasa ni ranking"
          badgeText="Sin dato API"
          badgeTone="neutral"
        />
      </div>

      {/* 2. Hallazgos Operacionales y Dictamen Forense Preliminar (Priorizado) */}
      <div className="stocky-formal-dictamen-panel">
        <div className="row justify-between align-center wrap gap-2">
          <div>
            <div className="stocky-formal-dictamen-title">
              {tieneMermas
                ? `Hallazgo forense: ${r2Resumen?.total_bultos_rechazados} bulto(s) excluido(s) por merma en destino`
                : "Hallazgo forense: Cadena de custodia intacta sin mermas registradas"}
            </div>
            <div className="stocky-formal-dictamen-body">
              {tieneMermas
                ? `Se registraron ${bultosVioladosCount} bulto(s) con incidencia en la recepción. El detalle de merma y su trazabilidad se consulta por cada bulto; el endpoint no informa ranking de locales ni valor de venta.`
                : "No se identificaron bultos rechazados ni roturas de precinto en el período y sedes evaluadas. Todos los despachos recibidos preservaron sus sellos inmutables."}
            </div>
          </div>

          {tieneMermas && r2Bultos.length > 0 && (
            <div className="no-print">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openR2DrillDown(r2Bultos[0].bulto_id)}
              >
                Auditar primer incidente
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Tabla Detallada de Bitácora de Bultos y Precintos (Priorizada) */}
      <div className="erp-table-card">
        <div className="p-3 border-b border-subtle row justify-between align-center">
          <div>
            <h3 className="erp-card-title">
              Bitácora de Bultos Rechazados y Precintos Violados (Regla V1)
            </h3>
            <p className="text-xs text-secondary">
              Haz clic en cualquier bulto o en "Peritaje Forense" para abrir la auditoría con stepper cronológico.
            </p>
          </div>
          <Badge tone="danger">{r2Bultos.length} incidentes</Badge>
        </div>

        {loadingR2 ? (
          <div className="p-4 stack gap-2">
            <Skeleton height={32} />
            <Skeleton height={32} />
            <Skeleton height={32} />
          </div>
        ) : r2Bultos.length === 0 ? (
          <EmptyState
            title="Sin mermas registradas"
            description="No se han registrado rechazos de bultos ni roturas de precinto en el período seleccionado."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setR2FechaInicio("");
                  setR2FechaFin("");
                  setR2LocalDestinoId("");
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
                  <th>Bulto ID</th>
                  <th>Remito</th>
                  <th>Precinto Registrado</th>
                  <th>Estado Precinto</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Fecha Rechazo</th>
                  <th className="text-right">Cant. Damnificada</th>
                  <th className="text-right">Pérdida Costo</th>
                  <th className="text-right">Pérdida Venta</th>
                  <th className="text-right no-print">Acción</th>
                </tr>
              </thead>
              <tbody>
                {r2Bultos.map((bulto) => (
                  <tr
                    key={bulto.bulto_id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => openR2DrillDown(bulto.bulto_id)}
                    title="Haz clic para peritaje forense"
                  >
                    <td className="font-mono text-xs font-medium">#{bulto.bulto_id}</td>
                    <td className="font-mono text-xs text-secondary">
                      {bulto.remito_numero || "N/A"}
                    </td>
                    <td className="font-mono text-xs font-medium">
                      {bulto.codigo_precinto || "SIN_PRECINTO"}
                    </td>
                    <td>
                      {bulto.precinto_intacto ? (
                        <Badge tone="success">Intacto</Badge>
                      ) : (
                        <Badge tone="danger">VIOLADO</Badge>
                      )}
                    </td>
                    <td className="text-xs text-secondary">{bulto.origen_nombre}</td>
                    <td className="text-xs font-medium">{bulto.destino_nombre}</td>
                    <td className="text-xs tabular-nums text-secondary whitespace-nowrap">
                      {bulto.fecha_rechazo
                        ? new Date(bulto.fecha_rechazo).toLocaleString("es-AR")
                        : "N/A"}
                    </td>
                    <td className="text-right tabular-nums font-medium text-danger">
                      -{bulto.total_unidades} un.
                    </td>
                    <td className="text-right tabular-nums font-medium text-danger">
                      ${bulto.total_perdida_costo?.toLocaleString("es-AR")}
                    </td>
                    <td className="text-right tabular-nums text-secondary">
                      {bulto.total_perdida_venta == null ? "No disponible" : `$${bulto.total_perdida_venta.toLocaleString("es-AR")}`}
                    </td>
                    <td className="text-right no-print" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openR2DrillDown(bulto.bulto_id)}
                      >
                        Peritaje Forense
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Visualizaciones Analíticas Secundarias (Debajo de la bitácora) */}
      <div className="border-t border-subtle pt-4">
        <div className="mb-3">
          <h4 className="text-sm font-medium text-secondary">
            Visualizaciones Analíticas Secundarias
          </h4>
          <p className="text-xs text-muted">
            Gráficos comparativos de impacto económico y tipificación causal de mermas en tránsito.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlotlyRenderer
            figure={r2Data?.grafico_mermas_por_local}
            title="Impacto Económico de Mermas por Local Receptor"
            subtitle="Pérdida patrimonial a costo y valor frustrado de venta por sucursal"
            badgeText="Impacto Financiero"
          />

          <PlotlyRenderer
            figure={r2Data?.grafico_motivos_rechazo}
            title="Distribución por Causal Forense de Rechazo"
            subtitle="Tipificación técnica de rotura de precintos y adulteración de faja de seguridad"
            badgeText="Peritaje Forense"
          />
        </div>
      </div>
    </div>
  );
}

export default ReporteR2MermasView;
