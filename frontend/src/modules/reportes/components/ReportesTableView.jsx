import React, { useMemo } from "react";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { Badge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { money, num } from "../services/reportesUnifiedService";

const MEDIOS = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};
const medioLabel = (m) => MEDIOS[String(m || "").toUpperCase()] || m || "No especificado";

export function ReportesTableView({
  reportKey,
  rows = [],
  loading = false,
  error = null,
  onRetry,
  onOpenStockDrillDown,
  onOpenMermaDrillDown,
}) {
  const rawColumns = useMemo(() => {
    switch (reportKey) {
      case "ventas":
        return [
          { key: "local_nombre", label: "Local", header: "Local", sortable: true },
          { key: "medio_pago", label: "Medio de cobro", header: "Medio de cobro", sortable: true, render: (v) => medioLabel(v) },
          { key: "cantidad_ventas", label: "Ventas", header: "Ventas", sortable: true, numeric: true, align: "right", render: (v) => num(v) },
          { key: "total_bruto", label: "Total bruto ($)", header: "Total bruto ($)", sortable: true, numeric: true, align: "right", render: (v) => money(v) },
          { key: "cantidad_devoluciones", label: "Devol.", header: "Devol.", sortable: true, numeric: true, align: "right", render: (v) => num(v) },
          { key: "total_devoluciones", label: "Monto devuelto ($)", header: "Monto devuelto ($)", sortable: true, numeric: true, align: "right", render: (v) => money(v) },
          {
            key: "total_neto",
            label: "Total neto ($)",
            header: "Total neto ($)",
            sortable: true,
            numeric: true,
            align: "right",
            render: (v) => <span className="font-medium text-foreground">{money(v)}</span>,
          },
        ];

      case "productos":
        return [
          {
            key: "codigo",
            label: "Código SKU",
            header: "Código SKU",
            sortable: true,
            render: (v) => <span className="font-mono text-xs">{v}</span>,
          },
          { key: "nombre", label: "Producto", header: "Producto", sortable: true },
          { key: "unidades_netas", label: "Unid. netas", header: "Unid. netas", sortable: true, numeric: true, align: "right", render: (v) => num(v) },
          { key: "ingresos", label: "Ingresos ($)", header: "Ingresos ($)", sortable: true, numeric: true, align: "right", render: (v) => money(v) },
          { key: "costo", label: "Costo ($)", header: "Costo ($)", sortable: true, numeric: true, align: "right", render: (v) => money(v) },
          {
            key: "margen",
            label: "Margen ($)",
            header: "Margen ($)",
            sortable: true,
            numeric: true,
            align: "right",
            render: (v, r) => (
              <span className={r.margen_negativo ? "text-danger font-medium" : "text-foreground"}>
                {money(v)}
              </span>
            ),
          },
          {
            key: "margen_porcentaje",
            label: "Margen (%)",
            header: "Margen (%)",
            sortable: true,
            numeric: true,
            align: "right",
            render: (v, r) => (
              <Badge tone={r.margen_negativo ? "danger" : Number(v) >= 20 ? "success" : "neutral"}>
                {num(v, 1)} %
              </Badge>
            ),
          },
          {
            key: "estado",
            label: "Estado comercial",
            header: "Estado comercial",
            render: (_, r) => (
              <Badge tone={r.margen_negativo ? "danger" : "success"}>
                {r.margen_negativo ? "A pérdida" : "Rentable"}
              </Badge>
            ),
          },
        ];

      case "transito":
        return [
          { key: "local_nombre", label: "Local destino", header: "Local destino", sortable: true },
          { key: "cantidad_bultos", label: "Bultos recibidos", header: "Bultos recibidos", sortable: true, numeric: true, align: "right", render: (v) => num(v) },
          { key: "promedio_horas", label: "Promedio (h)", header: "Promedio (h)", sortable: true, numeric: true, align: "right", render: (v) => `${num(v, 1)} h` },
          { key: "minimo_horas", label: "Mínimo (h)", header: "Mínimo (h)", sortable: true, numeric: true, align: "right", render: (v) => `${num(v, 1)} h` },
          { key: "maximo_horas", label: "Máximo (h)", header: "Máximo (h)", sortable: true, numeric: true, align: "right", render: (v) => `${num(v, 1)} h` },
          {
            key: "sla",
            label: "Cumplimiento SLA",
            header: "Cumplimiento SLA",
            render: (_, r) => (
              <Badge tone={Number(r.promedio_horas) <= 24 ? "success" : "warning"}>
                {Number(r.promedio_horas) <= 24 ? "Objetivo cumplido" : "Desvío detectado"}
              </Badge>
            ),
          },
        ];

      case "stock":
        return [
          {
            key: "producto_codigo",
            label: "Código SKU",
            header: "Código SKU",
            sortable: true,
            render: (v) => <span className="font-mono text-xs">{v}</span>,
          },
          { key: "producto_nombre", label: "Producto", header: "Producto", sortable: true },
          { key: "categoria_nombre", label: "Categoría", header: "Categoría", sortable: true, render: (v) => v || "General" },
          { key: "ubicacion_nombre", label: "Ubicación", header: "Ubicación", sortable: true },
          {
            key: "ubicacion_tipo",
            label: "Tipo",
            header: "Tipo",
            sortable: true,
            render: (v) => <Badge tone="neutral">{v || "Local"}</Badge>,
          },
          { key: "cantidad_disponible", label: "Disponible", header: "Disponible", sortable: true, numeric: true, align: "right", render: (v) => num(v) },
          { key: "cantidad_en_transito", label: "En tránsito", header: "En tránsito", sortable: true, numeric: true, align: "right", render: (v) => num(v) },
          { key: "nivel_minimo_existencia", label: "Mínimo", header: "Mínimo", sortable: true, numeric: true, align: "right", render: (v) => num(v) },
          {
            key: "estado_stock",
            label: "Estado de stock",
            header: "Estado de stock",
            sortable: true,
            render: (v) => (
              <Badge tone={v === "CRITICO" ? "danger" : v === "ADVERTENCIA" ? "warning" : "success"}>
                {v === "CRITICO" ? "Crítico (0 disp.)" : v === "ADVERTENCIA" ? "Bajo mínimo" : "Normal"}
              </Badge>
            ),
          },
          { key: "valorizacion_costo", label: "Val. Costo ($)", header: "Val. Costo ($)", sortable: true, numeric: true, align: "right", render: (v) => money(v) },
          { key: "valorizacion_venta", label: "Val. Venta ($)", header: "Val. Venta ($)", sortable: true, numeric: true, align: "right", render: (v) => money(v) },
          {
            key: "acciones",
            label: "Detalle",
            header: "Detalle",
            render: (_, r) => (
              <Button variant="ghost" size="sm" onClick={() => onOpenStockDrillDown(r.producto_id)}>
                Ficha técnica
              </Button>
            ),
          },
        ];

      case "mermas":
        return [
          {
            key: "bulto_id",
            label: "Bulto",
            header: "Bulto",
            sortable: true,
            render: (v) => <span className="font-mono text-xs">#{v}</span>,
          },
          { key: "remito_numero", label: "Remito", header: "Remito", sortable: true, render: (v) => v || "No informado" },
          { key: "codigo_precinto", label: "Precinto", header: "Precinto", render: (v) => v || "No informado" },
          { key: "origen_nombre", label: "Origen", header: "Origen", render: (v) => v || "CD Central" },
          { key: "destino_nombre", label: "Destino", header: "Destino", sortable: true, render: (v, r) => v || r.local_nombre || "No informado" },
          {
            key: "fecha_rechazo",
            label: "Fecha rechazo",
            header: "Fecha rechazo",
            sortable: true,
            render: (v) => (v ? new Date(v).toLocaleDateString("es-AR") : "No informada"),
          },
          {
            key: "total_unidades",
            label: "Unidades damnificadas",
            header: "Unidades damnificadas",
            sortable: true,
            numeric: true,
            align: "right",
            render: (v, r) => <span className="text-danger font-medium">-{num(v || r.unidades_perdidas)} un.</span>,
          },
          {
            key: "total_perdida_costo",
            label: "Pérdida costo ($)",
            header: "Pérdida costo ($)",
            sortable: true,
            numeric: true,
            align: "right",
            render: (v, r) => money(v || r.valor_perdido),
          },
          {
            key: "acciones",
            label: "Auditoría",
            header: "Auditoría",
            render: (_, r) => (
              <Button variant="ghost" size="sm" onClick={() => onOpenMermaDrillDown(r.bulto_id)}>
                Peritaje forense
              </Button>
            ),
          },
        ];

      default:
        return [];
    }
  }, [reportKey, onOpenStockDrillDown, onOpenMermaDrillDown]);

  const columns = useMemo(() => {
    return rawColumns.map((col) => ({
      ...col,
      header: col.header || col.label,
      label: col.label || col.header,
      align: col.align || (col.numeric ? "right" : undefined),
    }));
  }, [rawColumns]);

  const rowKeyGetter = useMemo(() => {
    switch (reportKey) {
      case "ventas":
        return (row) => `${row.local_id}-${row.medio_pago}`;
      case "productos":
        return (row) => String(row.producto_id);
      case "transito":
        return (row) => String(row.local_id);
      case "stock":
        return (row) => `${row.producto_id}-${row.ubicacion_id}`;
      case "mermas":
        return (row) => String(row.bulto_id);
      default:
        return (row) => String(row.id || Math.random());
    }
  }, [reportKey]);

  return (
    <div className="card overflow-hidden" aria-label="Tabla de datos del reporte">
      <SortableDataTable
        columns={columns}
        data={rows}
        rowKey={rowKeyGetter}
        loading={loading}
        error={error}
        onRetry={onRetry}
        selectable={false}
        emptyTitle="Sin datos registrados en el período"
        emptyDescription="No se encontraron registros con los parámetros seleccionados. Prueba ampliando el rango o cambiando la sede."
      />
    </div>
  );
}

export default ReportesTableView;
