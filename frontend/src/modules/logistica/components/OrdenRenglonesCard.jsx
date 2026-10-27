import React from "react";
import { Badge, SortableDataTable } from "../../../shared";

const itemColumns = [
  { key: "productoCodigo", header: "Código", mono: true, sortable: true },
  { key: "productoNombre", header: "Producto", sortable: true },
  {
    key: "cantidadSolicitada",
    header: "Solicitada",
    align: "right",
    sortable: true,
    render: (v) => <span className="tabular-nums font-medium">{v} u.</span>,
  },
  {
    key: "cantidadEmpaquetada",
    header: "En bultos",
    align: "right",
    sortable: true,
    render: (v) => <span className="tabular-nums">{v} u.</span>,
  },
  {
    key: "cantidadRestante",
    header: "Pendiente",
    align: "right",
    sortable: true,
    render: (v) => (
      <span className={`tabular-nums ${v > 0 ? "text-warning font-medium" : "text-muted"}`}>
        {v} u.
      </span>
    ),
  },
  {
    key: "completo",
    header: "Estado línea",
    render: (_, row) => (
      <Badge tone={row.completo ? "success" : row.cantidadEmpaquetada > 0 ? "warning" : "neutral"}>
        {row.completo ? "Completo" : row.cantidadEmpaquetada > 0 ? "Parcial" : "Pendiente"}
      </Badge>
    ),
  },
];

export function OrdenRenglonesCard({ detalles = [], totalSolicitadas = 0, totalEmpaquetadas = 0 }) {
  return (
    <div className="card p-4 stack gap-3">
      <div className="row justify-between align-center wrap gap-2">
        <div>
          <h2 className="text-md font-medium">Renglones solicitados y progreso de empaque</h2>
          <span className="text-xs text-secondary">
            {totalEmpaquetadas} de {totalSolicitadas} unidades ya están en bultos · {Math.max(0, totalSolicitadas - totalEmpaquetadas)} pendientes
          </span>
        </div>
        <span className="tabular-nums text-xs text-secondary">
          {detalles.length} artículo(s)
        </span>
      </div>

      <SortableDataTable
        columns={itemColumns}
        data={detalles}
        rowKey="productoId"
        emptyTitle="Sin renglones"
      />
    </div>
  );
}

export default OrdenRenglonesCard;
