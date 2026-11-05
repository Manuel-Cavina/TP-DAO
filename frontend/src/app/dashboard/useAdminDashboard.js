import { useState, useEffect, useCallback, useRef } from "react";
import { http } from "../../core/http";
import { summarizeDashboard, dashboardFreshness } from "./dashboardMetrics";

const resources = [
  ["alertas", "/api/stock/alertas"], ["stock", "/api/stock"],
  ["necesidades", "/api/logistica/necesidades"], ["ordenes", "/api/logistica/ordenes"],
  ["remitos", "/api/logistica/remitos"], ["ubicaciones", "/api/ubicaciones"],
  ["productos", "/api/catalogo/productos"],
  ["movimientos", "/api/logistica/trazabilidad/recientes"], ["ventas", "/api/ventas"],
];
const asRows = (value) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : null;
const field = (row, snake, camel) => row[snake] ?? row[camel];

export function useAdminDashboard({ intervalMs = 15000, enabled = true } = {}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(0);
  const [readNotificationIds, setReadNotificationIds] = useState(() => new Set());
  const generation = useRef(0);
  const mounted = useRef(false);
  const fetchDashboardData = useCallback(async (background = false) => {
    if (!enabled) return;
    const request = ++generation.current;
    if (!background) setLoading(true);
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();
    const results = await Promise.allSettled(resources.map(([key, path]) => http.get(path,
      key === "ventas" ? { params: { desde } } : key === "movimientos" ? { params: { limite: 8 } } : undefined)));
    if (!mounted.current || request !== generation.current) return;
    const next = {}, failed = {};
    results.forEach((result, index) => {
      const key = resources[index][0];
      const rows = result.status === "fulfilled" ? asRows(result.value) : null;
      if (rows) next[key] = rows;
      else failed[key] = result.reason || new Error("Respuesta no disponible");
    });
    setData((previous) => ({ ...previous, ...next }));
    setErrors(failed);
    if (!Object.keys(failed).length) setLastUpdated(Date.now());
    setNow(Date.now());
    setLoading(false);
  }, [enabled]);
  useEffect(() => {
    mounted.current = true;
    fetchDashboardData();
    const timer = setInterval(() => { if (!document.hidden) fetchDashboardData(true); }, intervalMs);
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; generation.current++; clearInterval(timer); clearInterval(ticker); };
  }, [fetchDashboardData, intervalMs]);

  const metrics = summarizeDashboard(data);
  const ubicMap = new Map((data.ubicaciones || []).map((row) => [String(row.id), row]));
  const prodMap = new Map((data.productos || []).map((row) => [String(row.id), row]));
  const alertasAccionables = (data.alertas || []).filter((row) => !row.leida).map((row) => {
    const ubicacionId = field(row, "ubicacion_id", "ubicacionId");
    const productoId = field(row, "producto_id", "productoId");
    const ubicacion = ubicMap.get(String(ubicacionId));
    const producto = prodMap.get(String(productoId));
    const disponible = field(row, "cantidad_disponible", "disponible");
    const minimo = field(row, "nivel_minimo", "nivelMinimo");
    return {
      id: `stock-${row.id}`, categoria: "Reposición", severidad: Number(disponible) === 0 ? "critica" : "alta",
      titulo: producto?.nombre || `Producto #${productoId ?? "sin identificar"}`,
      descripcion: `${ubicacion?.nombre || "Ubicación no informada"} · ${disponible ?? "Sin dato"} disponibles · mínimo ${minimo ?? "sin dato"}`,
      accionLabel: "Revisar reposición", accionRuta: `/stock/alertas${ubicacionId ? `?ubicacionId=${ubicacionId}` : ""}`,
    };
  });
  const tasks = [
    { id: "preparar", label: "Órdenes por preparar", count: metrics.ordersToPrepare, description: "Armado, precintos y aprobación en el centro de origen", route: "/logistica/operaciones", action: "Preparar órdenes", source: "ordenes" },
    { id: "despachar", label: "Remitos por despachar", count: metrics.remitosToDispatch, description: "Documentos pendientes de salida", route: "/logistica/operaciones", action: "Revisar despacho", source: "remitos" },
    { id: "recibir", label: "Arribo y control en destino", count: metrics.remitosToReceiveOrControl, description: "Remitos en tránsito o recibidos, pendientes de control o cierre", route: "/logistica/operaciones", action: "Revisar recepción", source: "remitos" },
    { id: "reponer", label: "Alertas de reposición", count: metrics.stockAlerts, description: "Alertas sin leer para revisar existencias y reposición", route: "/stock/alertas", action: "Revisar alertas", source: "alertas" },
  ].map((task) => ({ ...task, stale: Boolean(errors[task.source]) }));
  const ultimosMovimientos = (data.movimientos || []).map((evento) => {
    const rawDate = evento.fecha_hora || evento.fechaHora;
    const fecha = rawDate ? new Date(rawDate) : null;
    const sede = ubicMap.get(String(evento.destino_id || evento.origen_id));
    return {
      id: evento.id,
      hora: fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleString("es-AR") : "Sin fecha informada",
      entidad: evento.entidad_id ? `${evento.tipo_entidad || "Entidad"} #${evento.entidad_id}` : "Entidad no informada",
      accion: String(evento.accion || "Acción no informada").replaceAll("_", " "),
      responsableNombre: evento.actor || "No informado", sede: sede?.nombre || "No informada",
      consecuencia: evento.motivo_o_evidencia || (evento.estado_nuevo ? `${evento.estado_anterior || "Sin estado previo"} → ${evento.estado_nuevo}` : "Sin evidencia adicional"),
    };
  });
  const freshness = dashboardFreshness(lastUpdated, now, Object.keys(errors).length > 0);
  return {
    loading, error: Object.keys(errors).length ? new Error("Algunas fuentes no pudieron actualizarse") : null,
    errors, refresh: () => fetchDashboardData(), lastUpdated, freshnessSeconds: freshness.seconds, isStale: freshness.isStale,
    metrics, tasks, alertasAccionables, ultimosMovimientos,
    redInfo: {
      centrosActivos: data.ubicaciones?.filter((row) => row.tipo === "CD" && row.activo !== false).length ?? null,
      localesActivos: data.ubicaciones?.filter((row) => row.tipo === "LOCAL" && row.activo !== false).length ?? null,
    },
    marcarNotificacionLeida: (id) => setReadNotificationIds((current) => new Set([...current, id])), readNotificationIds,
  };
}
export default useAdminDashboard;
