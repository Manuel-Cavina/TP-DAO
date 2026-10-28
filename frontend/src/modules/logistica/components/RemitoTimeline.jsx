import React, { useMemo } from "react";
import { StatusBadge } from "../../../shared/components/Badge";

/**
 * RemitoTimeline (T050 / FR-029 / US4):
 * Linea temporal inmutable de trazabilidad para el ciclo de vida del remito.
 */
export function RemitoTimeline({
  remito,
  origenNombre,
  destinoNombre,
  responsableNombre,
}) {
  const events = useMemo(() => {
    if (!remito) return [];
    const list = [];

    // 1. Emision de remito
    list.push({
      id: `ev-remito-emitido-${remito.numero}`,
      titulo: `Remito #${remito.numero} emitido`,
      fecha: remito.fechaEmision
        ? new Date(remito.fechaEmision).toLocaleString("es-AR")
        : "Fecha de emisión",
      actor: responsableNombre || "Operador de Despacho",
      ubicacion: origenNombre || `CD #${remito.origenId}`,
      estado: "EMITIDO",
      descripcion: `Emisión de documento de transporte que agrupa ${remito.totalBultos || 0} bulto(s) precintados con destino a ${destinoNombre || `Local #${remito.destinoId}`}.`,
    });

    // 2. Despacho
    const esDespachadoOPosterior =
      remito.documentoEstado === "DESPACHADO" ||
      remito.documentoEstado === "RECIBIDO" ||
      remito.documentoEstado === "CERRADO";

    if (esDespachadoOPosterior) {
      list.push({
        id: `ev-remito-despachado-${remito.numero}`,
        titulo: `Remito #${remito.numero} despachado`,
        fecha: "Registrado",
        actor: "Transportista / Logística",
        ubicacion: `En ruta: ${origenNombre} -> ${destinoNombre}`,
        estado: "DESPACHADO",
        descripcion: `Salida formal del Centro de Distribución. Todos los bultos pasaron a estado En tránsito sin acreditar stock en destino.`,
      });
    }

    // 3. Recepcion en destino
    const esRecibidoOPosterior =
      remito.documentoEstado === "RECIBIDO" || remito.documentoEstado === "CERRADO";

    if (esRecibidoOPosterior) {
      list.push({
        id: `ev-remito-recibido-${remito.numero}`,
        titulo: `Remito #${remito.numero} arribado y recibido`,
        fecha: "Registrado",
        actor: "Operador de Sucursal",
        ubicacion: destinoNombre || `Local #${remito.destinoId}`,
        estado: "RECIBIDO",
        descripcion: `Arribo formal en sucursal destino para control individual de precintos de seguridad.`,
      });
    }

    // 4. Cierre y acreditacion de stock / mermas
    if (remito.documentoEstado === "CERRADO") {
      list.push({
        id: `ev-remito-cerrado-${remito.numero}`,
        titulo: `Remito #${remito.numero} cerrado y liquidado`,
        fecha: "Registrado",
        actor: "Responsable de Recepción",
        ubicacion: destinoNombre || `Local #${remito.destinoId}`,
        estado: "CERRADO",
        descripcion: `Control físico concluido. ${remito.bultosVerificados || 0} bulto(s) acreditados a stock vendible y ${remito.bultosRechazados || 0} bulto(s) registrados como merma (Regla V1).`,
      });
    }

    return list;
  }, [remito, origenNombre, destinoNombre, responsableNombre]);

  return (
    <div className="card p-4 stack gap-3">
      <div className="row justify-between align-center">
        <h3 className="text-md font-medium">Línea temporal inmutable de trazabilidad</h3>
        <span className="text-xs text-secondary">{events.length} evento(s) registrados</span>
      </div>

      <div className="erp-timeline">
        {events.map((ev) => (
          <div key={ev.id} className="erp-timeline__item">
            <div className="erp-timeline__marker" />
            <div className="erp-timeline__content">
              <div className="row justify-between align-center wrap gap-2">
                <span className="text-sm font-medium">{ev.titulo}</span>
                <StatusBadge status={ev.estado} />
              </div>
              <div className="row gap-3 text-xs text-muted mt-1">
                <span>{ev.fecha}</span>
                <span>·</span>
                <span>{ev.actor}</span>
                <span>·</span>
                <span>{ev.ubicacion}</span>
              </div>
              <p className="text-sm text-secondary mt-1">{ev.descripcion}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RemitoTimeline;
