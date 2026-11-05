/** Presentation only. These labels never authorize or execute a transition. */
export function orderWorkflowSteps(orden, remito) {
  const closed = orden?.estado === "CERRADA" || remito?.estado === "CERRADO";
  const dispatched = closed || orden?.estado === "DESPACHADA" || ["DESPACHADO", "EN_TRANSITO", "RECIBIDO"].includes(remito?.estado);
  const received = closed || remito?.estado === "RECIBIDO";
  return [
    { tab: "resumen", label: "Resumen", detail: "Solicitud y cantidades" },
    { tab: "empaque", label: "Empaque y precintos", detail: remito ? "Remito emitido" : "Armar, precintar y aprobar" },
    { tab: "despacho", label: "Remito y despacho", detail: dispatched ? "Despacho registrado" : remito ? "Pendiente de despacho" : "Pendiente de emisión" },
    { tab: "recepcion", label: "Recepción y cierre", detail: closed ? "Recepción cerrada" : received ? "Controlar y cerrar" : dispatched ? "Registrar arribo" : "Arribo pendiente" },
    { tab: "historial", label: "Historial", detail: "Evidencia del traslado" },
  ];
}
