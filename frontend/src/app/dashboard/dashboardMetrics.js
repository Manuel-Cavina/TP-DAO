const count = (rows, states) => Array.isArray(rows) ? rows.filter((row) => states.includes(String(row.estado || "").toUpperCase())).length : null;
export function summarizeDashboard({ ordenes, remitos, ventas, alertas, necesidades, productos } = {}) {
  return {
    orderCount: Array.isArray(ordenes) ? ordenes.length : null,
    productCount: Array.isArray(productos) ? productos.length : null,
    ordersToPrepare: count(ordenes, ["PENDIENTE", "EN_PREPARACION", "BORRADOR"]),
    remitosToDispatch: count(remitos, ["EMITIDO", "EN_PREPARACION", "GENERADO"]),
    remitosInTransit: count(remitos, ["DESPACHADO", "EN_TRANSITO"]),
    remitosToReceiveOrControl: count(remitos, ["DESPACHADO", "EN_TRANSITO", "RECIBIDO"]),
    stockAlerts: Array.isArray(alertas) ? alertas.filter((row) => !row.leida).length : null,
    pendingNeeds: Array.isArray(necesidades) ? necesidades.filter((row) => !row.estado || row.estado === "PENDIENTE").length : null,
    salesCount: Array.isArray(ventas) ? ventas.length : null,
    // Gross recorded sales. This is not net cash without refunds.
    salesTotal: Array.isArray(ventas) ? ventas.reduce((sum, row) => sum + (Number(row.total) || 0), 0) : null,
  };
}
export function dashboardFreshness(lastUpdated, now, hasErrors) {
  const seconds = lastUpdated ? Math.max(0, Math.floor((now - lastUpdated) / 1000)) : null;
  return { seconds, isStale: Boolean(hasErrors) || seconds === null || seconds > 30 };
}
