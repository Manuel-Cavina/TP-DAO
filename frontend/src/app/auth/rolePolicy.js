/** Operational routes exclude master data, sales, reporting and order creation. */
export function isOperatorPathAllowed(pathname) {
  return /^\/logistica\/(?:recepcion|trazabilidad|empaquetado|operaciones|kanban|ordenes|remitos)\/?$/.test(pathname)
    || /^\/logistica\/(?:ordenes|bultos)\/[1-9]\d*\/?$/.test(pathname)
    || /^\/logistica\/remitos\/[^/]+\/?$/.test(pathname);
}
