import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { logisticaService } from "../services";
import { mapOrdenToUI, mapBultoToUI } from "../mappers/logisticaMappers";

export function OrdenDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ubicaciones } = useUbicaciones();

  const [orden, setOrden] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [ordRes, bultosRes] = await Promise.all([
        logisticaService.obtenerOrden(id),
        logisticaService.listarBultosPorOrden(id).catch(() => []),
      ]);
      setOrden(mapOrdenToUI(ordRes));
      const bultosList = Array.isArray(bultosRes) ? bultosRes : bultosRes?.data || [];
      setBultos(bultosList.map(mapBultoToUI));
    } catch (err) {
      setError(err.message || "Error al cargar la orden de reposición.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const itemColumns = [
    { key: "productoId", header: "ID Producto", mono: true },
    {
      key: "cantidadSolicitada",
      header: "Cantidad solicitada",
      align: "right",
      render: (v) => <span className="tabular-nums font-medium">{v} u.</span>,
    },
    {
      key: "cantidadEnviada",
      header: "Cantidad preparada / enviada",
      align: "right",
      render: (v) => <span className="tabular-nums">{v} u.</span>,
    },
    {
      key: "estadoItem",
      header: "Estado de entrega",
      render: (_, row) => {
        const completa = row.cantidadEnviada >= row.cantidadSolicitada;
        return (
          <StatusBadge
            status={completa ? "VERIFICADO" : row.cantidadEnviada > 0 ? "EN_TRANSITO" : "PENDIENTE"}
            customLabel={completa ? "Completo" : row.cantidadEnviada > 0 ? "Parcial" : "Pendiente"}
          />
        );
      },
    },
  ];

  const bultoColumns = [
    { key: "id", header: "ID Bulto", mono: true },
    {
      key: "codigoPrecinto",
      header: "Precinto asignado",
      mono: true,
      render: (v) => v || <span className="text-muted">Sin precinto</span>,
    },
    {
      key: "estado",
      header: "Estado",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "itemsCount",
      header: "Contenido",
      align: "right",
      render: (_, row) => {
        const totalU = row.detalles?.reduce((s, d) => s + d.cantidad, 0) || 0;
        return <span className="tabular-nums">{totalU} unidades</span>;
      },
    },
  ];

  if (loading) {
    return (
      <div className="p-8 text-center text-secondary">
        Cargando detalle de la orden de reposición...
      </div>
    );
  }

  if (error || !orden) {
    return (
      <div className="card p-6 stack gap-4 text-center">
        <h2 className="text-lg text-danger">No se pudo cargar la orden</h2>
        <p className="text-sm text-secondary">{error || "La orden solicitada no existe."}</p>
        <div className="row justify-center">
          <Button variant="secondary" onClick={() => navigate("/logistica/ordenes")}>
            Volver al listado de órdenes
          </Button>
        </div>
      </div>
    );
  }

  const isPendienteOrPreparando =
    orden.estado === "PENDIENTE" || orden.estado === "EN_PREPARACION";

  return (
    <div className="stack gap-5">
      {/* Header con breadcrumb */}
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span
              className="cursor-pointer text-secondary"
              onClick={() => navigate("/logistica/ordenes")}
            >
              Distribución
            </span>
            <span>·</span>
            <span
              className="cursor-pointer text-secondary"
              onClick={() => navigate("/logistica/ordenes")}
            >
              Órdenes de reposición
            </span>
            <span>·</span>
            <span>Orden #{orden.id}</span>
          </div>
          <div className="row gap-3 align-center mt-1">
            <h1 className="text-xl">Orden de reposición #{orden.id}</h1>
            <StatusBadge status={orden.estado} />
          </div>
        </div>

        {/* ÚNICA SIGUIENTE ACCIÓN EXPLÍCITA */}
        <div className="row gap-2 align-center">
          {isPendienteOrPreparando && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => navigate(`/logistica/empaquetado?ordenId=${orden.id}`)}
            >
              Pasar a empaquetado
            </Button>
          )}

          {orden.estado === "DESPACHADA" && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => navigate("/logistica/recepcion")}
            >
              Ir a recepción en destino
            </Button>
          )}
        </div>
      </div>

      {/* Origen y Destino */}
      <div className="grid-3 gap-3">
        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Origen (Centro de distribución)</span>
          <span className="text-sm font-medium">
            {ubicMap.get(orden.origenId) || `CD #${orden.origenId}`}
          </span>
          <span className="text-xs text-secondary">Abastece el stock</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Destino (Local comercial)</span>
          <span className="text-sm font-medium">
            {ubicMap.get(orden.destinoId) || `Local #${orden.destinoId}`}
          </span>
          <span className="text-xs text-secondary">Receptor de mercadería</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Fecha de emisión</span>
          <span className="text-sm font-medium">
            {orden.fecha ? new Date(orden.fecha).toLocaleDateString("es-AR") : "-"}
          </span>
          <span className="text-xs text-secondary">
            {bultos.length} bulto(s) armado(s)
          </span>
        </div>
      </div>

      {/* Renglones de artículos de la orden */}
      <div className="stack gap-2">
        <div className="row justify-between align-center">
          <h2 className="text-md">Líneas de artículos de la orden</h2>
          <span className="text-xs text-secondary">
            {orden.detalles.length} artículo(s)
          </span>
        </div>
        <SortableDataTable
          columns={itemColumns}
          data={orden.detalles}
          rowKey="productoId"
          emptyTitle="Sin renglones"
        />
      </div>

      {/* Bultos armados para esta orden */}
      <div className="stack gap-2 pt-3 border-t">
        <div className="row justify-between align-center">
          <h2 className="text-md">Bultos armados para esta orden ({bultos.length})</h2>
          {isPendienteOrPreparando && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft="package"
              onClick={() => navigate(`/logistica/empaquetado?ordenId=${orden.id}`)}
            >
              Armar o precintar bultos
            </Button>
          )}
        </div>

        <SortableDataTable
          columns={bultoColumns}
          data={bultos}
          rowKey="id"
          emptyTitle="Sin bultos armados aún"
          emptyDescription="Comience el proceso de empaquetado para armar los bultos con la mercadería de la orden."
        />
      </div>
    </div>
  );
}

export default OrdenDetallePage;
