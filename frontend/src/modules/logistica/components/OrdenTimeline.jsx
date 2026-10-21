import React, { useMemo } from "react";
import { StatusBadge } from "../../../shared/components/Badge";

export function OrdenTimeline({
  orden,
  bultos = [],
  remito = null,
  origenNombre,
  destinoNombre,
  responsableNombre,
}) {
  const events = useMemo(() => {
    if (!orden) return [];
    const list = [];

    // 1. Creación de la orden
    list.push({
      id: "ev-orden-creada",
      titulo: `Orden de reposición #${orden.id} registrada`,
      fecha: orden.fecha ? new Date(orden.fecha).toLocaleString("es-AR") : "Fecha inicial",
      actor: responsableNombre || "Operador de Logística",
      ubicacion: origenNombre || `CD #${orden.origenId}`,
      estado: "PENDIENTE",
      descripcion: `Emisión de orden formal con ${orden.detalles?.length || 0} renglón(es) hacia ${destinoNombre || `Local #${orden.destinoId}`}.`,
    });

    // 2. Preparación y precintado de bultos
    bultos.forEach((b) => {
      const totalUnits = (b.detalles || []).reduce((sum, d) => sum + (d.cantidad || 0), 0);
      list.push({
        id: `ev-bulto-${b.id}`,
        titulo: `Bulto #${b.id} preparado`,
        fecha: orden.fecha ? new Date(orden.fecha).toLocaleDateString("es-AR") : "-",
        actor: responsableNombre || "Operador de Logística",
        ubicacion: origenNombre,
        estado: b.estado,
        descripcion: `Bulto armado con ${totalUnits} unidades.${b.codigoPrecinto ? ` Precintado con código ${b.codigoPrecinto}.` : " Pendiente de precinto."}`,
      });
    });

    // 3. Emisión de remito si existe
    if (remito) {
      list.push({
        id: `ev-remito-${remito.numero}`,
        titulo: `Remito #${remito.numero} generado`,
        fecha: remito.fechaEmision ? new Date(remito.fechaEmision).toLocaleString("es-AR") : "-",
        actor: responsableNombre || "Operador de Despacho",
        ubicacion: origenNombre,
        estado: remito.estado,
        descripcion: `Remito único formal emitido agrupando ${bultos.length} bulto(s) para transporte seguro.`,
      });

      if (remito.estado === "DESPACHADO" || remito.estado === "EN_TRANSITO") {
        list.push({
          id: `ev-despacho-${remito.numero}`,
          titulo: `Remito #${remito.numero} despachado en tránsito`,
          fecha: "-",
          actor: "Transportista / Logística",
          ubicacion: `En ruta: ${origenNombre} -> ${destinoNombre}`,
          estado: "DESPACHADO",
          descripcion: "Mercadería en tránsito hacia la sucursal destino bajo precintos inviolables.",
        });
      }

      if (remito.estado === "RECIBIDO") {
        list.push({
          id: `ev-recibido-${remito.numero}`,
          titulo: `Remito #${remito.numero} recibido en destino`,
          fecha: "-",
          actor: "Operador de Sucursal",
          ubicacion: destinoNombre,
          estado: "RECIBIDO",
          descripcion: "Recepción de bultos en local destino para control individual de precintos de seguridad.",
        });
      }

      if (remito.estado === "CERRADO") {
        list.push({
          id: `ev-cerrado-${remito.numero}`,
          titulo: `Remito #${remito.numero} cerrado con acreditación de stock`,
          fecha: "-",
          actor: "Responsable de Recepción",
          ubicacion: destinoNombre,
          estado: "CERRADO",
          descripcion: "Control físico finalizado. Ingreso formal al stock vendible para bultos verificados y merma para rechazados (Regla V1).",
        });
      }
    }

    return list;
  }, [orden, bultos, remito, origenNombre, destinoNombre, responsableNombre]);

  return (
    <div className="stack gap-3">
      <div className="row justify-between align-center">
        <h3 className="text-md font-medium">Línea temporal inmutable de trazabilidad</h3>
        <span className="text-xs text-secondary">{events.length} evento(s) registrados</span>
      </div>

      <div className="erp-timeline">
        {events.map((ev) => (
          <div key={ev.id} className="erp-timeline__item stack gap-1">
            <div className="row justify-between align-center wrap gap-2">
              <span className="text-sm font-medium">{ev.titulo}</span>
              <StatusBadge status={ev.estado} />
            </div>
            <p className="text-xs text-secondary">{ev.descripcion}</p>
            <div className="row gap-3 wrap text-xs text-muted pt-1">
              <span>{ev.fecha}</span>
              <span>·</span>
              <span>Responsable: {ev.actor}</span>
              <span>·</span>
              <span>Ubicación: {ev.ubicacion}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrdenTimeline;
