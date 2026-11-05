// One owner for task labels, destinations and active-route matching.
export const ADMIN_TASK_GROUPS = [
  { id: "inicio", label: "Inicio", icon: "chart", defaultPath: "/dashboard", items: [
    { id: "inicio-panel", label: "Panel operativo", path: "/dashboard" },
  ] },
  { id: "distribucion", label: "Distribución", icon: "truck", defaultPath: "/logistica/operaciones", items: [
    { id: "operaciones-tablero", label: "Trabajo pendiente", path: "/logistica/operaciones", aliases: ["/logistica/kanban"] },
    { id: "distribucion-ordenes", label: "Órdenes y remitos", path: "/logistica/ordenes", aliases: ["/logistica/historial", "/logistica/remitos", "/logistica/bultos", "/logistica/empaquetado", "/logistica/recepcion"] },
    { id: "distribucion-trazabilidad", label: "Trazabilidad", path: "/logistica/trazabilidad" },
  ] },
  { id: "inventario", label: "Inventario", icon: "warehouse", defaultPath: "/stock/stock", items: [
    { id: "inventario-stock", label: "Stock por ubicación", path: "/stock/stock", aliases: ["/stock/ingresos"] },
    { id: "inventario-alertas", label: "Reposición", path: "/stock/alertas" },
  ] },
  { id: "ventas", label: "Ventas y caja", icon: "credit-card", defaultPath: "/ventas", items: [
    { id: "ventas-pos", label: "Punto de venta", path: "/ventas", defaultQuery: { tab: "pos" } },
    { id: "ventas-caja", label: "Comprobantes y caja", path: "/ventas?tab=facturas" },
    { id: "ventas-devoluciones", label: "Devoluciones", path: "/ventas?tab=devoluciones" },
  ] },
  { id: "control", label: "Reportes", icon: "chart", defaultPath: "/reportes/ventas", items: [
    { id: "control-ventas", label: "Ventas", path: "/reportes/ventas" },
    { id: "control-productos", label: "Productos", path: "/reportes/productos" },
    { id: "control-transito", label: "En tránsito", path: "/reportes/transito" },
    { id: "control-stock", label: "Stock", path: "/reportes/stock" },
    { id: "control-mermas", label: "Mermas", path: "/reportes/mermas" },
  ] },
  { id: "maestros", label: "Configuración", icon: "package", defaultPath: "/catalogo/productos", items: [
    { id: "maestros-productos", label: "Productos", path: "/catalogo/productos" },
    { id: "maestros-categorias", label: "Categorías", path: "/catalogo/categorias" },
    { id: "maestros-proveedores", label: "Proveedores", path: "/catalogo/proveedores" },
    { id: "maestros-ubicaciones", label: "Centros y locales", path: "/stock/ubicaciones", aliases: ["/red"] },
  ] },
];

export const OPERATOR_TASK_GROUPS = [
  { id: "trabajo", label: "Mi trabajo", icon: "warehouse", defaultPath: "/operador", items: [
    { id: "operador-trabajo", label: "Mi trabajo", path: "/operador" },
  ] },
  { id: "operaciones", label: "Distribución", icon: "truck", defaultPath: "/logistica/operaciones", items: [
    { id: "operador-operaciones", label: "Operaciones", path: "/logistica/operaciones", aliases: ["/logistica/kanban", "/logistica/ordenes", "/logistica/bultos", "/logistica/remitos", "/logistica/recepcion", "/logistica/empaquetado"] },
    { id: "operador-trazabilidad", label: "Trazabilidad", path: "/logistica/trazabilidad" },
  ] },
];

export function matchNavigation(currentPath, groups = ADMIN_TASK_GROUPS) {
  const current = new URL(currentPath || "/", "https://stocky.invalid");
  const candidates = groups.flatMap((group) => group.items.flatMap((item) =>
    [item.path, ...(item.aliases || [])].map((path) => ({ group, item, route: new URL(path, current.origin) }))));
  const matches = candidates.filter(({ item, route }) => {
    if (current.pathname !== route.pathname && !current.pathname.startsWith(`${route.pathname}/`)) return false;
    for (const [key, value] of route.searchParams) if (current.searchParams.get(key) !== value) return false;
    for (const [key, value] of Object.entries(item.defaultQuery || {})) {
      if (current.searchParams.has(key) && current.searchParams.get(key) !== value) return false;
    }
    return true;
  });
  matches.sort((a, b) => b.route.pathname.length - a.route.pathname.length || [...b.route.searchParams].length - [...a.route.searchParams].length);
  return matches[0] || null;
}
