/**
 * Utilidades de cálculo de bloqueadores y orientación por solapas para OrdenDetallePage.
 */
export function computeBloqueadoresOrden({
  orden,
  bultos = [],
  remito = null,
  totalSolicitadas = 0,
  totalEmpaquetadas = 0,
}) {
  if (!orden) return [];
  const list = [];

  if (orden.estado === "PENDIENTE" && bultos.length === 0) {
    list.push({
      id: "b-sin-iniciar",
      tone: "info",
      titulo: "Empaquetado pendiente",
      desc: "La orden aún no cuenta con bultos preparados. Debe iniciar el empaquetado para abastecer las unidades solicitadas.",
    });
  } else if (totalEmpaquetadas < totalSolicitadas) {
    list.push({
      id: "b-incompleto",
      tone: "warning",
      titulo: "Cantidades pendientes de empaque",
      desc: `Quedan ${totalSolicitadas - totalEmpaquetadas} unidad(es) solicitadas sin asignar a bultos (${totalEmpaquetadas} de ${totalSolicitadas} empaquetadas).`,
    });
  }

  const bultosSinPrecinto = bultos.filter((b) => b.estado === "PREPARADO" || !b.codigoPrecinto);
  if (bultosSinPrecinto.length > 0) {
    list.push({
      id: "b-sin-precinto",
      tone: "warning",
      titulo: "Bultos pendientes de precinto",
      desc: `Hay ${bultosSinPrecinto.length} bulto(s) sin precinto de seguridad asignado. Es requisito obligatorio que todo bulto esté precintado para emitir remito.`,
    });
  }

  const bultosSinAprobar = bultos.filter((b) => !b.aprobado);
  if (bultosSinPrecinto.length === 0 && bultosSinAprobar.length > 0 && !remito) {
    list.push({
      id: "b-sin-aprobar",
      tone: "warning",
      titulo: "Bultos pendientes de aprobación",
      desc: `Hay ${bultosSinAprobar.length} bulto(s) precintado(s) sin aprobar. Todo bulto debe estar aprobado para emitir remito.`,
    });
  }

  if (
    bultos.length > 0 &&
    totalEmpaquetadas >= totalSolicitadas &&
    bultosSinPrecinto.length === 0 &&
    bultosSinAprobar.length === 0 &&
    !remito &&
    orden.estado !== "DESPACHADA" &&
    orden.estado !== "CERRADA"
  ) {
    list.push({
      id: "b-listo-remito",
      tone: "success",
      titulo: "Lista para emisión de remito",
      desc: "Todos los artículos requeridos están empaquetados y sus bultos precintados y aprobados. La orden se encuentra lista para generar su remito único.",
    });
  }

  return list;
}

export function computeGuidanceByTab({
  orden,
  bultos = [],
  remito = null,
  totalSolicitadas = 0,
  totalEmpaquetadas = 0,
  estaCompletamenteEmpaquetada = false,
  bultosTodosPrecintados = false,
  onEmitirRemito,
  onDespachar,
  puedeOperar = true,
}) {
  if (!orden) return {};
  const bultosTodosAprobados = bultos.length > 0 && bultos.every((b) => b.aprobado);
  const listaParaRemito = estaCompletamenteEmpaquetada && bultosTodosPrecintados && bultosTodosAprobados;
  const isPendienteOrPreparando =
    orden.estado === "PENDIENTE" || orden.estado === "EN_PREPARACION";

  const guidance = {
    resumen: orden.estado === "CERRADA"
      ? { tone: "success", title: "Orden cerrada: no queda trabajo operativo", description: "Empaque, remito y recepción finalizaron. Consultá el historial para la evidencia completa.", targetTab: "historial", targetLabel: "Ver historial" }
      : { tone: "info", title: "Estado actual de la orden", description: `${totalEmpaquetadas} de ${totalSolicitadas} unidades empaquetadas · ${bultos.length} bulto(s) registrado(s).`, targetTab: isPendienteOrPreparando ? "empaque" : "recepcion", targetLabel: isPendienteOrPreparando ? "Continuar empaque" : "Gestionar recepción" },
    empaque: remito
      ? { tone: "success", title: "Empaque y precintos completados", description: `${bultos.length} bulto(s) forman parte de ${remito.numero}. La evidencia de armado y precintos sigue disponible en esta orden.`, targetTab: remito.estado === "EMITIDO" ? "despacho" : "recepcion", targetLabel: remito.estado === "EMITIDO" ? "Despachar remito" : "Continuar recepción" }
      : {
          tone: !listaParaRemito ? "warning" : "info",
          title: !listaParaRemito ? "Empaque en curso" : "Bultos listos para remito",
          description: !estaCompletamenteEmpaquetada
            ? `Faltan ${totalSolicitadas - totalEmpaquetadas} unidad(es) por asignar a un bulto.`
            : !bultosTodosPrecintados
            ? "Hay bultos sin precinto asignado. Completá el precintado para emitir remito."
            : !bultosTodosAprobados
            ? "Hay bultos precintados sin aprobar. Aprobalos para emitir el remito."
            : "Todos los bultos están empaquetados, precintados y aprobados; el siguiente paso es emitir el remito.",
          onAction: listaParaRemito ? onEmitirRemito : null,
          targetTab: null,
          targetLabel: listaParaRemito ? "Emitir remito" : null,
        },
    despacho: !estaCompletamenteEmpaquetada || !bultosTodosPrecintados
      ? { tone: "warning", title: "Despacho bloqueado por empaque pendiente", description: `Hay ${totalSolicitadas - totalEmpaquetadas} unidad(es) sin empaquetar o bultos sin precinto.`, targetTab: "empaque", targetLabel: "Resolver empaque" }
      : !remito && !bultosTodosAprobados
        ? { tone: "warning", title: "Remito bloqueado por aprobación pendiente", description: "Todos los bultos deben estar aprobados antes de emitir el remito.", targetTab: "empaque", targetLabel: "Aprobar bultos" }
      : !remito
        ? { tone: "info", title: "Lista para emitir el remito", description: `${bultos.length} bulto(s) completos, precintados y aprobados esperan el documento formal de traslado.`, onAction: onEmitirRemito, targetLabel: "Emitir remito" }
        : remito.estado === "EMITIDO"
          ? { tone: "info", title: `Remito ${remito.numero} emitido`, description: "El documento y los bultos ya están listos; el próximo paso es despachar el traslado.", onAction: onDespachar, targetLabel: "Despachar remito" }
          : { tone: "success", title: `Despacho registrado: ${remito.numero}`, description: `El remito está ${remito.estado.toLowerCase()}. La recepción se trabaja dentro de esta misma orden.`, targetTab: "recepcion", targetLabel: "Ir a recepción" },
    recepcion: !remito || remito.estado === "EMITIDO"
      ? { tone: "info", title: "Recepción aún no habilitada", description: "Primero debe emitirse y despacharse el remito; después se registra el arribo y se revisan los precintos.", targetTab: "despacho", targetLabel: "Ir a remito y despacho" }
      : remito.estado === "CERRADO"
        ? { tone: "success", title: "Recepción cerrada: no queda trabajo pendiente", description: `${remito.bultosVerificados} bulto(s) verificados y ${remito.bultosRechazados} rechazado(s) quedaron registrados con su impacto de stock.`, targetTab: "historial", targetLabel: "Ver historial" }
        : remito.estado === "RECIBIDO"
          ? { tone: "warning", title: "Arribo registrado: falta verificar precintos", description: `${remito.bultosPendientes} bulto(s) requieren control físico antes del cierre.`, targetTab: null, targetLabel: null }
          : { tone: "info", title: "Remito en tránsito", description: "El siguiente paso es registrar el arribo en destino para habilitar el control de precintos.", targetTab: null, targetLabel: null },
    historial: { tone: "info", title: "Trazabilidad completa de la orden", description: "La línea de vida conserva orden, bultos, precintos, remito y cierre. No altera el estado operativo.", targetTab: null, targetLabel: null },
  };
  if (puedeOperar) return guidance;

  // Fuera del alcance del operador se conserva el diagnostico pero sin CTAs de empaque ni despacho
  const sinAccion = (g) => ({ ...g, onAction: null, targetTab: null, targetLabel: null });
  const enCursoDeOrigen = !remito || remito.estado === "EMITIDO";
  return {
    ...guidance,
    resumen: isPendienteOrPreparando ? sinAccion(guidance.resumen) : guidance.resumen,
    empaque: enCursoDeOrigen ? sinAccion(guidance.empaque) : guidance.empaque,
    despacho: enCursoDeOrigen ? sinAccion(guidance.despacho) : guidance.despacho,
  };
}
