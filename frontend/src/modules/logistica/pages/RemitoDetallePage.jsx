import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  StatusBadge,
  SortableDataTable,
  Modal,
  useDisclosure,
  useLiveResource,
  LiveIndicator,
} from "../../../shared";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useAuth } from "../../../app/auth/AuthProvider";
import { logisticaService } from "../services";
import { mapRemitoToUI } from "../mappers/logisticaMappers";
import { RemitoTimeline } from "../components/RemitoTimeline";

/**
 * RemitoDetallePage (T050 / US4):
 * Detalle completo de remito con estado de documento separado del progreso
 * operacional de bultos, bloqueadores de despacho, trazabilidad inmutable y
 * boton unico primario de despacho.
 */
export function RemitoDetallePage() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ubicaciones } = useUbicaciones();

  const [despachando, setDespachando] = useState(false);
  const [despachoError, setDespachoError] = useState("");
  const despachoModal = useDisclosure(false);

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );

  const fetchRemitoData = useCallback(async () => {
    if (!numero) return null;
    const res = await logisticaService.obtenerRemito(numero);
    return mapRemitoToUI(res);
  }, [numero]);

  // Contrato de frescura operativo de 15 segundos (FR-028, SC-014)
  const {
    data: remito,
    error,
    isLoading,
    freshnessSeconds,
    isStale,
    refresh,
  } = useLiveResource(fetchRemitoData, {
    enabled: Boolean(numero),
    intervalMs: 15000,
  });

  const origenNombre = remito ? ubicMap.get(remito.origenId) || `CD #${remito.origenId}` : "";
  const destinoNombre = remito ? ubicMap.get(remito.destinoId) || `Local #${remito.destinoId}` : "";
  const responsableNombre = user?.displayName || user?.name || "Operador de Despacho";

  // Identificacion de bloqueadores de despacho (FR-030)
  const bloqueadoresDespacho = useMemo(() => {
    if (!remito) return [];
    const list = [];

    if (remito.documentoEstado !== "EMITIDO") {
      list.push(`El documento ya no está en estado EMITIDO (estado actual: ${remito.documentoEstado}).`);
    }

    if (!remito.bultosResumen || remito.bultosResumen.length === 0) {
      list.push("El remito no cuenta con bultos asociados para transportar.");
    }

    const sinPrecinto = (remito.bultosResumen || []).filter((b) => !b.codigoPrecinto);
    if (sinPrecinto.length > 0) {
      list.push(`Existen ${sinPrecinto.length} bulto(s) sin precinto de seguridad registrado.`);
    }

    if (isStale) {
      list.push("La frescura de los datos no pudo confirmarse (bloqueo preventivo por red).");
    }

    return list;
  }, [remito, isStale]);

  const esDespachable = remito?.documentoEstado === "EMITIDO" && bloqueadoresDespacho.length === 0;

  const handleConfirmarDespacho = async () => {
    if (!esDespachable) return;
    setDespachando(true);
    setDespachoError("");
    try {
      await logisticaService.despacharRemito(numero);
      despachoModal.onClose();
      await refresh();
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
      render: (v) =>
        v ? (
          <span className="font-mono font-medium">{v}</span>
        ) : (
          <span className="text-muted text-xs">Sin precinto</span>
        ),
    },
    {
      key: "estado",
      header: "Estado físico del bulto",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "cantidadItems",
      header: "Unidades totales",
      align: "right",
      render: (v) => <span className="tabular-nums font-medium">{v} u.</span>,
    },
  ];

  if (isLoading && !remito) {
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

  return (
    <div className="stack gap-5">
      {/* Header con breadcrumb y frescura */}
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span className="cursor-pointer text-secondary" onClick={() => navigate("/logistica/remitos")}>
              Distribución
            </span>
            <span>·</span>
            <span className="cursor-pointer text-secondary" onClick={() => navigate("/logistica/remitos")}>
              Remitos
            </span>
            <span>·</span>
            <span className="font-mono">{remito.numero}</span>
          </div>

          <div className="row gap-3 align-center mt-1">
            <h1 className="text-xl">Remito de traslado {remito.numero}</h1>
            <StatusBadge status={remito.documentoEstado} />
            <LiveIndicator freshnessSeconds={freshnessSeconds} isStale={isStale} onRefresh={refresh} />
          </div>
        </div>

        {/* FR-043: Exactamente una accion primaria visible por contexto */}
        <div>
          {remito.documentoEstado === "EMITIDO" && (
            <Button
              variant="primary"
              iconLeft="truck"
              onClick={despachoModal.onOpen}
              disabled={!esDespachable}
            >
              Despachar remito
            </Button>
          )}

          {remito.documentoEstado === "DESPACHADO" && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => navigate(`/logistica/recepcion?remito=${encodeURIComponent(remito.numero)}`)}
            >
              Ir a recepción en destino
            </Button>
          )}

          {remito.documentoEstado === "RECIBIDO" && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => navigate(`/logistica/recepcion?remito=${encodeURIComponent(remito.numero)}`)}
            >
              Continuar verificación de precintos
            </Button>
          )}

          {remito.documentoEstado === "CERRADO" && (
            <span className="badge-pill bg-success-subtle text-success text-sm font-medium">
              Remito cerrado y liquidado
            </span>
          )}
        </div>
      </div>

      {/* Origen, Destino y Fecha */}
      <div className="grid-3 gap-3">
        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Centro de distribución (Origen)</span>
          <span className="text-sm font-medium">{origenNombre}</span>
          <span className="text-xs text-secondary">Sede emisora</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Sucursal receptora (Destino)</span>
          <span className="text-sm font-medium">{destinoNombre}</span>
          <span className="text-xs text-secondary">Destino final</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Fecha de emisión</span>
          <span className="text-sm font-medium">
            {remito.fechaEmision ? new Date(remito.fechaEmision).toLocaleDateString("es-AR") : "-"}
          </span>
          <span className="text-xs text-secondary">Documento formal de traslado</span>
        </div>
      </div>

      {/* Progreso de bultos separado del estado del documento (FR-027) */}
      <div className="card p-4 stack gap-3">
        <div className="row justify-between align-center">
          <h2 className="text-md font-medium">Progreso físico de bultos</h2>
          <span className="text-xs text-secondary">
            {remito.progresoOperacional?.resumenTexto || `${remito.totalBultos} bulto(s)`}
          </span>
        </div>

        <div className="grid-4 gap-3">
          <div className="p-3 rounded bg-surface-muted stack gap-1">
            <span className="text-xs text-muted">Total bultos</span>
            <span className="text-lg font-medium tabular-nums">{remito.totalBultos}</span>
            <span className="text-xs text-secondary">En este remito</span>
          </div>

          <div className="p-3 rounded bg-surface-muted stack gap-1">
            <span className="text-xs text-muted">Verificados conformes</span>
            <span className="text-lg font-medium tabular-nums text-success">
              {remito.bultosVerificados}
            </span>
            <span className="text-xs text-secondary">Precinto intacto</span>
          </div>

          <div className="p-3 rounded bg-surface-muted stack gap-1">
            <span className="text-xs text-muted">Rechazados por merma</span>
            <span className="text-lg font-medium tabular-nums text-danger">
              {remito.bultosRechazados}
            </span>
            <span className="text-xs text-secondary">Precinto violado</span>
          </div>

          <div className="p-3 rounded bg-surface-muted stack gap-1">
            <span className="text-xs text-muted">Pendientes de control</span>
            <span className="text-lg font-medium tabular-nums text-primary">
              {remito.bultosPendientes}
            </span>
            <span className="text-xs text-secondary">En tránsito o arribados</span>
          </div>
        </div>
      </div>

      {/* Bloqueadores de despacho (FR-030) */}
      {remito.documentoEstado === "EMITIDO" && (
        <div className="card p-4 stack gap-2">
          <h3 className="text-sm font-medium">Control previo a la salida</h3>
          {bloqueadoresDespacho.length > 0 ? (
            <div className="p-3 rounded bg-danger-subtle text-danger text-sm stack gap-1">
              <strong className="block">Despacho bloqueado:</strong>
              {bloqueadoresDespacho.map((b, idx) => (
                <span key={idx}>· {b}</span>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded bg-success-subtle text-success text-sm">
              Sin bloqueadores: todos los bultos poseen precintos de seguridad asignados y el remito está listo para despachar.
            </div>
          )}
        </div>
      )}

      {/* Tabla completa de bultos */}
      <div className="card p-4 stack gap-3">
        <div className="row justify-between align-center">
          <h2 className="text-md font-medium">Detalle individual de bultos del remito</h2>
          <span className="text-xs text-secondary">
            {remito.bultosResumen?.length || 0} bulto(s) amparado(s)
          </span>
        </div>

        <SortableDataTable
          columns={bultoColumns}
          data={remito.bultosResumen || []}
          rowKey="id"
          emptyTitle="Sin bultos en este remito"
        />
      </div>

      {/* Linea temporal inmutable de trazabilidad (T050 / FR-029) */}
      <RemitoTimeline
        remito={remito}
        origenNombre={origenNombre}
        destinoNombre={destinoNombre}
        responsableNombre={responsableNombre}
      />

      {/* Modal de confirmacion explícita de despacho */}
      <Modal
        open={despachoModal.open}
        onClose={despachoModal.onClose}
        title="Confirmar despacho de remito"
        subtitle={`Documento: ${remito.numero} · Despacho desde ${origenNombre}`}
        footer={
          <div className="row justify-between w-full">
            <Button variant="ghost" onClick={despachoModal.onClose} disabled={despachando}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmarDespacho}
              loading={despachando}
              loadingLabel="Despachando remito..."
              disabled={!esDespachable}
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
              <span className="text-sm font-medium">{origenNombre}</span>
            </div>
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Destino</span>
              <span className="text-sm font-medium">{destinoNombre}</span>
            </div>
          </div>

          <div className="stack gap-2">
            <span className="text-xs text-muted font-medium">
              BULTOS A DESPACHAR ({remito.totalBultos} BULTOS)
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
              Consecuencia operativa: Al confirmar el despacho, los bultos cambiarán a
              estado En tránsito y la mercadería pasará a registrarse como cantidad en tránsito
              hacia el local receptor. No acredita stock en el local hasta la recepción y control de precintos.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default RemitoDetallePage;
