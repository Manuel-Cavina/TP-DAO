/** Operational routes exclude master data, sales, reporting and order creation. */
export function isOperatorPathAllowed(pathname) {
  return /^\/logistica\/(?:recepcion|trazabilidad|empaquetado|operaciones|kanban|ordenes|remitos)\/?$/.test(pathname)
    || /^\/logistica\/(?:ordenes|bultos)\/[1-9]\d*\/?$/.test(pathname)
    || /^\/logistica\/remitos\/[^/]+\/?$/.test(pathname);
}

/**
 * Mirrors the backend scope rule (Usuario.puede_operar): ADMIN is unrestricted;
 * any other user can operate on a location only when it is its reporting CD or
 * one of its authorised branches. Without scope or location it cannot operate.
 */
export function puedeOperarEnUbicacion(user, scope, ubicacionId) {
  if (String(user?.role || "").toUpperCase() === "ADMIN") return true;
  if (!scope || ubicacionId === null || ubicacionId === undefined || ubicacionId === "") return false;
  const target = String(ubicacionId);
  if (scope.reporting_cd_id !== null && scope.reporting_cd_id !== undefined && String(scope.reporting_cd_id) === target) {
    return true;
  }
  const branches = scope.authorised_branch_ids || scope.branch_ids || [];
  return branches.some((id) => String(id) === target);
}

export const MENSAJE_FUERA_DE_ALCANCE =
  "Tu asignación no incluye el origen de esta orden: no podés empaquetar, aprobar ni despachar.";
