import React from "react";
import { Button } from "../../../shared/components/Button";

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function ReporteExportToolbar({
  reportKey = "r1",
  reportTitle = "Reporte",
  dataRows = [],
  rawReportData = null,
  activeFiltersDesc = "Sin filtros adicionales",
  filters = {},
}) {
  const handlePrintPDF = () => {
    const params = new URLSearchParams();
    params.set("reporte", reportKey === "r2" ? "mermas" : "stock");
    if (filters && typeof filters === "object") {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined && v !== false) {
          params.set(k, String(v));
        }
      });
    }
    params.set("autoPrint", "1");
    const printUrl = `/reportes/imprimible?${params.toString()}`;
    const win = window.open(printUrl, "_blank");
    if (!win) {
      window.location.assign(printUrl);
    }
  };

  const handleExportCSV = () => {
    if (!dataRows || !dataRows.length) {
      alert("No hay datos disponibles para exportar.");
      return;
    }

    let headers = [];
    let rowsFormatted = [];

    if (reportKey === "r1") {
      headers = [
        "ID Producto",
        "Código SKU",
        "Nombre Producto",
        "Categoría",
        "ID Ubicación",
        "Ubicación",
        "Tipo Nodo",
        "Disponible",
        "En Tránsito",
        "Total Existencias",
        "Stock Mínimo",
        "Estado Stock",
        "Faltante",
        "Costo Unitario ($)",
        "Precio Venta ($)",
        "Valorización Costo ($)",
        "Valorización Venta ($)",
        "Margen Potencial ($)",
      ];

      rowsFormatted = dataRows.map((r) => [
        r.producto_id,
        r.producto_codigo,
        r.producto_nombre,
        r.categoria_nombre,
        r.ubicacion_id,
        r.ubicacion_nombre,
        r.ubicacion_tipo,
        r.cantidad_disponible,
        r.cantidad_en_transito,
        r.total_existencias,
        r.nivel_minimo_existencia,
        r.estado_stock,
        r.faltante,
        r.costo_unitario,
        r.precio_venta,
        r.valorizacion_costo,
        r.valorizacion_venta,
        r.margen_potencial,
      ]);
    } else {
      headers = [
        "ID Bulto",
        "ID Orden Reposición",
        "Número Remito",
        "Código Precinto",
        "Precinto Intacto",
        "Origen CD",
        "Destino Local",
        "Fecha de Rechazo",
        "Motivo de Rechazo",
        "Total Unidades Perdidas",
        "Pérdida Total Costo ($)",
        "Pérdida Total Venta ($)",
      ];

      rowsFormatted = dataRows.map((b) => [
        b.bulto_id,
        b.orden_id,
        b.remito_numero || "N/A",
        b.codigo_precinto || "SIN_PRECINTO",
        b.precinto_intacto ? "SI" : "NO_VIOLADO",
        b.origen_nombre,
        b.destino_nombre,
        b.fecha_rechazo ? new Date(b.fecha_rechazo).toLocaleString("es-AR") : "N/A",
        b.motivo_rechazo,
        b.total_unidades,
        b.total_perdida_costo,
        b.total_perdida_venta,
      ]);
    }

    const csvContent =
      "\uFEFF" + // UTF-8 BOM para soporte de caracteres acentuados en Excel
      [headers.map(escapeCSV).join(",")]
        .concat(rowsFormatted.map((row) => row.map(escapeCSV).join(",")))
        .join("\r\n");

    const getExportBaseName = () => {
      if (reportKey === "r1" || reportKey === "stock" || String(reportKey).includes("stock")) {
        return "stocky-salud-stock";
      }
      if (reportKey === "r2" || reportKey === "mermas" || String(reportKey).includes("merma")) {
        return "stocky-mermas-precintos";
      }
      const slug = (reportKey || "reporte")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return `stocky-${slug}`;
    };

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${getExportBaseName()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const getExportBaseName = () => {
      if (reportKey === "r1" || reportKey === "stock" || String(reportKey).includes("stock")) {
        return "stocky-salud-stock";
      }
      if (reportKey === "r2" || reportKey === "mermas" || String(reportKey).includes("merma")) {
        return "stocky-mermas-precintos";
      }
      const slug = (reportKey || "reporte")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return `stocky-${slug}`;
    };

    const payload = {
      empresa: "Stocky",
      denominacion_oficial:
        "Stocky · Sistema de Ventas e Inventario: Centro de Distribución a Locales",
      emision: {
        fecha_hora: new Date().toISOString(),
        operador: "Martín Gómez (Control Central de Inventario)",
        reporte: reportTitle,
        clave_reporte: reportKey,
        filtros_activos: activeFiltersDesc,
      },
      datos: rawReportData || dataRows,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${getExportBaseName()}-datos-crudos.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stocky-export-group no-print">
      <Button
        variant="secondary"
        size="sm"
        onClick={handlePrintPDF}
        title="Imprimir o guardar como PDF con membrete oficial Stocky"
      >
        <span className="row align-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Exportar PDF
        </span>
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={handleExportCSV}
        title="Descargar tabla en formato CSV (UTF-8 con BOM para Excel)"
      >
        <span className="row align-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </span>
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={handleExportJSON}
        title="Descargar estructura de datos crudos en formato JSON"
      >
        <span className="row align-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Exportar JSON
        </span>
      </Button>
    </div>
  );
}
