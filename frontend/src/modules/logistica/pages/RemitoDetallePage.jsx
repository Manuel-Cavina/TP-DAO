import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";
import { MetricCard } from "../../../shared/components/Feedback";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { Modal } from "../../../shared/components/Motion";
import { useDisclosure } from "../../../shared/hooks";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { logisticaService } from "../services";
import { mapRemitoToUI } from "../mappers/logisticaMappers";

export function RemitoDetallePage() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { ubicaciones } = useUbicaciones();

  const [remito, setRemito] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [despachando, setDespachando] = useState(false);
  const [despachoError, setDespachoError] = useState("");

  const despachoModal = useDisclosure(false);

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );

  const loadRemito = async () => {
    if (!numero) return;
    setLoading(true);
    setError(null);
    try {
      const res = await logisticaService.obtenerRemito(numero);
      setRemito(mapRemitoToUI(res));
    } catch (err) {
      setError(err.message || "Error al cargar el remito.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemito();
  }, [numero]);

  const handleConfirmarDespacho = async () => {
    setDespachando(true);
    setDespachoError("");
    try {
      await logisticaService.despacharRemito(numero);
      despachoModal.onClose();
      await loadRemito();
    } catch (err) {
      setDespachoError(err.message || "Error al despachar el remito.");
    } finally {
      setDespachando(false);
    }
  };

  const bultoColumns = [
    {
      key: "codigo",
      header: "Código / ID",
      mono: true,
      render: (_, row) => (
        <span>
          {row.codigo || `BLT-${row.id}`} <span className="text-xs text-muted">(#{row.id})</span>
        </span>
      ),
    },
    {
      key: "codigoPrecinto",
      header: "Precinto de seguridad",
      mono: true,
      render: (v) => v || <span className="text-muted">Sin precinto</span>,
    },
    {
      key: "estado",
      header: "Estado operacional del bulto",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "cantidadItems",
      header: "Unidades totales",
      align: "right",
      render: (v) => <span className="tabular-nums font-medium">{v} u.</span>,
    },
  ];

  if (loading) {
    return (
      <div className="p-8 text-center text-secondary">
        Cargando detalle del remito #{numero}...
      </div>
    );
  }

  if (error || !remito) {
    return (
      <div className="card p-6 stack gap-4 text-center">
        <h2 className="text-lg text-danger">No se pudo cargar el remito</h2>
        <p className="text-sm text-secondary">{error || "El remito solicitado no existe."}</p>
        <div className="row justify-center">
          <Button variant="secondary" onClick={() => navigate("/logistica/remitos")}>
            Volver al listado de remitos
          </Button>
        </div>
      </div>
    );
  }

  const isEmitido = remito.documentoEstado === "EMITIDO";
  const isDespachado = remito.documentoEstado === "DESPACHADO";
  const isCerrado = remito.documentoEstado === "CERRADO";

  return (
    <div className="stack gap-5">
      {/* Header con breadcrumb */}
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span
              className="cursor-pointer text-secondary"
              onClick={() => navigate("/logistica/remitos")}
            >
              Distribución
            </span>
            <span>·</span>
            <span
              className="cursor-pointer text-secondary"
              onClick={() => navigate("/logistica/remitos")}
            >
              Remitos
            </span>
            <span>·</span>
            <span className="font-mono">{remito.numero}</span>
          </div>
          <div className="row gap-3 align-center mt-1">
            <h1 className="text-xl">Remito de despacho {remito.numero}</h1>
            <StatusBadge status={remito.documentoEstado} />
          </div>
        </div>

        {/* ÚNICA SIGUIENTE ACCIÓN EXPLÍCITA */}
        <div className="row gap-2 align-center">
          {isEmitido && (
            <Button
              variant="primary"
              iconLeft="truck"
              onClick={despachoModal.onOpen}
            >
              Confirmar despacho
            </Button>
          )}

          {isDespachado && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => navigate(`/logistica/recepcion?remito=${encodeURIComponent(remito.numero)}`)}
            >
              Ir a recepción en destino
            </Button>
          )}

          {isCerrado && (
            <span className="text-sm text-success font-medium">
              Remito cerrado y liquidado
            </span>
          )}
        </div>
      </div>

      {/* Origen y Destino */}
      <div className="grid-3 gap-3">
        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Centro de distribución emisor</span>
          <span className="text-sm font-medium">
            {ubicMap.get(remito.origenId) || `CD #${remito.origenId}`}
          </span>
          <span className="text-xs text-secondary">Sede origen</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Sucursal receptora</span>
          <span className="text-sm font-medium">
            {ubicMap.get(remito.destinoId) || `Local #${remito.destinoId}`}
          </span>
          <span className="text-xs text-secondary">Destino final</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Fecha de emisión</span>
          <span className="text-sm font-medium">
            {remito.fechaEmision
              ? new Date(remito.fechaEmision).toLocaleDateString("es-AR")
              : "-"}
          </span>
          <span className="text-xs text-secondary">
            Documento legal de traslado
          </span>
        </div>
      </div>

      {/* Métricas de progreso operacional de bultos */}
      <div className="stack gap-2">
        <div className="row justify-between align-center">
          <h2 className="text-md">Progreso operacional de bultos</h2>
          <span className="text-xs text-secondary">
            {remito.progresoOperacional?.resumenTexto || `${remito.totalBultos} bultos`}
          </span>
        </div>

        <div className="grid-4 gap-3">
          <MetricCard
            label="Total bultos"
            value={remito.totalBultos}
            subtext="En este remito"
          />
          <MetricCard
            label="Verificados conformes"
            value={remito.bultosVerificados}
            subtext="Precinto intacto"
            badgeTone={remito.bultosVerificados > 0 ? "success" : "neutral"}
          />
          <MetricCard
            label="Rechazados por merma"
            value={remito.bultosRechazados}
            subtext="Precinto violado"
            badgeTone={remito.bultosRechazados > 0 ? "danger" : "neutral"}
          />
          <MetricCard
            label="Pendientes de control"
            value={remito.bultosPendientes}
            subtext="En tránsito o recibidos"
            badgeTone={remito.bultosPendientes > 0 ? "warning" : "success"}
          />
        </div>
      </div>

      {/* Lista detallada de bultos del remito */}
      <div className="stack gap-2 pt-2 border-t">
        <div className="row justify-between align-center">
          <h2 className="text-md">Detalle individual de bultos precintados</h2>
          <span className="text-xs text-secondary">
            {remito.bultosResumen?.length || 0} bulto(s) listado(s)
          </span>
        </div>

        <SortableDataTable
          columns={bultoColumns}
          data={remito.bultosResumen || []}
          rowKey="id"
          emptyTitle="Sin bultos asignados al remito"
        />
      </div>

      {/* Modal de confirmación explícita de despacho */}
      <Modal
        open={despachoModal.open}
        onClose={despachoModal.onClose}
        title="Confirmar despacho de remito"
        subtitle={`Documento: ${remito.numero} · Despacho desde Centro de Distribución`}
        footer={
          <div className="row justify-between w-full">
            <Button variant="ghost" onClick={despachoModal.onClose} disabled={despachando}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmarDespacho}
              loading={despachando}
              loadingLabel="Despachando..."
            >
              Confirmar salida a tránsito
            </Button>
          </div>
        }
      >
        <div className="stack gap-4">
          {despachoError && (
            <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
              {despachoError}
            </div>
          )}

          <div className="grid-2 gap-3">
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Origen</span>
              <span className="text-sm font-medium">
                {ubicMap.get(remito.origenId) || `CD #${remito.origenId}`}
              </span>
            </div>
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Destino</span>
              <span className="text-sm font-medium">
                {ubicMap.get(remito.destinoId) || `Local #${remito.destinoId}`}
              </span>
            </div>
          </div>

          <div className="stack gap-2">
            <span className="text-xs text-muted">
              Bultos a despachar ({remito.totalBultos} bultos)
            </span>
            <div className="stack gap-1 max-h-40 overflow-y-auto">
              {(remito.bultosResumen || []).map((b) => (
                <div key={b.id} className="row justify-between align-center p-2 rounded bg-surface-muted text-sm">
                  <span className="font-mono">Bulto #{b.id}</span>
                  <span className="text-xs text-secondary">
                    Precinto: <strong className="font-mono">{b.codigoPrecinto || "N/A"}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="erp-callout">
            <span className="text-sm text-secondary">
              Impacto operativo: Al confirmar el despacho, los bultos cambiarán a estado
              'En tránsito' y la mercadería pasará a registrarse como cantidad en tránsito
              hacia el local receptor. La orden de reposición pasará a estado DESPACHADA.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default RemitoDetallePage;
