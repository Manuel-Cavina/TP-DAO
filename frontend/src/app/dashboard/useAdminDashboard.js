import { useState, useEffect, useCallback, useRef } from "react";
import { http } from "../../core/http";

/**
 * useAdminDashboard (`frontend/src/app/dashboard/useAdminDashboard.js`)
 * Consume endpoints reales del backend:
 * - /api/stock/alertas
 * - /api/stock
 * - /api/logistica/necesidades
 * - /api/logistica/ordenes
 * - /api/logistica/remitos
 * - /api/ubicaciones
 *
 * Calcula alertas accionables, trabajo pendiente, conteos de ciclo de vida,
 * metricas de tendencia con comparacion temporal semantica (FR-044) y frescura live 15s (FR-028).
 */
export function useAdminDashboard({ intervalMs = 15000, enabled = true } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [readNotificationIds, setReadNotificationIds] = useState(() => new Set());

  // Datos crudos normalizados
  const [alertasRaw, setAlertasRaw] = useState([]);
  const [stockRaw, setStockRaw] = useState([]);
  const [necesidadesRaw, setNecesidadesRaw] = useState([]);
  const [ordenesRaw, setOrdenesRaw] = useState([]);
  const [remitosRaw, setRemitosRaw] = useState([]);
  const [ubicacionesRaw, setUbicacionesRaw] = useState([]);
  const [productosRaw, setProductosRaw] = useState([]);
  const [movimientosRaw, setMovimientosRaw] = useState([]);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!enabled) return;
    if (!isBackground) setLoading(true);

    try {
      const [
        alertasRes,
        stockRes,
        necesidadesRes,
        ordenesRes,
        remitosRes,
        ubicacionesRes,
        productosRes,
        movimientosRes,
      ] = await Promise.allSettled([
        http.get("/api/stock/alertas"),
        http.get("/api/stock"),
        http.get("/api/logistica/necesidades"),
        http.get("/api/logistica/ordenes"),
        http.get("/api/logistica/remitos"),
        http.get("/api/ubicaciones"),
        http.get("/api/catalogo/productos"),
        http.get("/api/logistica/trazabilidad/recientes", { params: { limite: 6 } }),
      ]);

      if (!isMountedRef.current) return;

      const failed = [alertasRes, stockRes, necesidadesRes, ordenesRes, remitosRes, ubicacionesRes, productosRes, movimientosRes]
        .find((res) => res.status === "rejected");
      if (failed) throw failed.reason;

      const unwrap = (res) => Array.isArray(res.value) ? res.value : res.value?.data || [];

      setAlertasRaw(unwrap(alertasRes));
      setStockRaw(unwrap(stockRes));
      setNecesidadesRaw(unwrap(necesidadesRes));
      setOrdenesRaw(unwrap(ordenesRes));
      setRemitosRaw(unwrap(remitosRes));
      setUbicacionesRaw(unwrap(ubicacionesRes));
      setProductosRaw(unwrap(productosRes));
      setMovimientosRaw(unwrap(movimientosRes));

      setError(null);
      const timestamp = Date.now();
      setLastUpdated(timestamp);
      setNow(timestamp);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  // Polling cada 15 segundos (FR-028)
  useEffect(() => {
    if (!enabled) return;

    fetchDashboardData(false);

    const intervalTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchDashboardData(true);
    }, intervalMs);

    return () => clearInterval(intervalTimer);
  }, [enabled, intervalMs, fetchDashboardData]);

  // Ticker de segundos transcurridos
  useEffect(() => {
    if (!lastUpdated) return;
    const ticker = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastUpdated]);

  const freshnessSeconds = lastUpdated
    ? Math.max(0, Math.floor((now - lastUpdated) / 1000))
    : 0;

  const isStale = Boolean(error) || freshnessSeconds > 15;

  // Mapeos auxiliares
  const ubicMap = new Map((ubicacionesRaw || []).map((u) => [u.id, u]));
  const prodMap = new Map((productosRaw || []).map((p) => [p.id, p]));

  // 1. Red logística activa
  const cdsActivos = ubicacionesRaw.filter(
    (u) => (u.tipo === "CD" || u.scope === "CD") && u.activo !== false
  );
  const localesActivos = ubicacionesRaw.filter(
    (u) => u.tipo === "LOCAL" && u.activo !== false
  );

  const centrosLabel = cdsActivos.length > 0
    ? cdsActivos.map((c) => c.nombre).join(" · ")
    : "Sin centros activos";
  const localesLabel = localesActivos.length > 0
    ? localesActivos.map((l) => l.nombre).join(" · ")
    : "Sin locales activos";

  // 2. Alertas accionables compuestas
  const alertasAccionables = [];

  // Alertas de stock bajo mínimo (Observer)
  const unreadStockAlerts = alertasRaw.filter((a) => !a.leida);
  unreadStockAlerts.forEach((a) => {
    const ubic = ubicMap.get(a.ubicacion_id);
    const prod = prodMap.get(a.producto_id);
    const isCD = ubic?.tipo === "CD" || ubic?.scope === "CD";
    const disponible = Number(a.cantidad_disponible) || 0;
    const minimo = Number(a.nivel_minimo) || 0;
    const esCritica = disponible === 0;

    alertasAccionables.push({
      id: `stock-alerta-${a.id}`,
      alertaId: a.id,
      tipo: "stock_bajo",
      titulo: esCritica
        ? `Stock agotado: ${prod?.nombre || `SKU-${a.producto_id}`}`
        : `${prod?.nombre || `SKU-${a.producto_id}`} bajo mínimo`,
      descripcion: `${ubic?.nombre || `Sede #${a.ubicacion_id}`} · ${disponible} u. disponibles (mín. ${minimo} u.)`,
      severidad: esCritica ? "critica" : "alta",
      categoria: "Stock",
      accionLabel: isCD ? "Ingresar stock en CD" : "Crear reposición",
      accionRuta: isCD
        ? `/stock/alertas?urgencia=${esCritica ? "critica" : "alta"}&ubicacionId=${a.ubicacion_id}`
        : `/logistica/ordenes/crear?productoId=${a.producto_id}&destinoId=${a.ubicacion_id}`,
      accionTipo: isCD ? "ingreso_cd" : "orden_reposicion",
      accionParametros: {
        productoId: a.producto_id,
        ubicacionId: a.ubicacion_id,
        cdId: isCD ? a.ubicacion_id : cdsActivos[0]?.id,
      },
      timestamp: a.fecha_emision
        ? new Date(a.fecha_emision).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : null,
      entidad: {
        tipo: "Stock",
        id: prod?.codigo || `SKU-${a.producto_id}`,
        label: prod?.nombre || `Producto #${a.producto_id}`,
      },
    });
  });

  // Remitos demorados o en tránsito
  remitosRaw.forEach((r) => {
    const estado = (r.estado || "").toUpperCase();
    if (estado === "DESPACHADO" || estado === "EN_TRANSITO") {
      const destino = ubicMap.get(r.destino_id);
      alertasAccionables.push({
        id: `remito-${r.numero}`,
        tipo: "remito_demorado",
        titulo: `Remito ${r.numero} en tránsito`,
        descripcion: `${destino?.nombre || `Sede #${r.destino_id}`} · pendiente de recepción y verificación`,
        severidad: "critica",
        categoria: "Logística",
        accionLabel: "Registrar recepción",
        accionRuta: `/logistica/recepcion?remito=${encodeURIComponent(r.numero)}`,
        accionTipo: "recepcion_remito",
        accionParametros: { numero: r.numero },
        timestamp: "En tránsito",
        entidad: {
          tipo: "Remito",
          id: r.numero,
          label: `Remito ${r.numero}`,
        },
      });
    }
  });

  // Órdenes con bultos sin precinto o en preparación
  ordenesRaw.forEach((o) => {
    const estado = (o.estado || "").toUpperCase();
    if (estado === "EN_PREPARACION" || estado === "PENDIENTE") {
      alertasAccionables.push({
        id: `orden-${o.id}`,
        tipo: "orden_preparacion",
        titulo: `Orden OR-${String(o.id).padStart(6, "0")} pendiente`,
        descripcion: "Bultos listos para empaquetado o asignación de precinto",
        severidad: "media",
        categoria: "Bloqueo",
        accionLabel: "Asignar precintos",
        accionRuta: `/logistica/empaquetado?ordenId=${o.id}`,
        accionTipo: "empaquetado",
        accionParametros: { ordenId: o.id },
        timestamp: "En preparación",
        entidad: {
          tipo: "Orden",
          id: `OR-${o.id}`,
          label: `Orden OR-${String(o.id).padStart(6, "0")}`,
        },
      });
    }
  });

  // 3. Trabajo pendiente
  const ordenesPorPrepararCount = ordenesRaw.filter((o) => {
    const e = (o.estado || "").toUpperCase();
    return e === "PENDIENTE" || e === "EN_PREPARACION" || e === "BORRADOR";
  }).length;

  const remitosPorDespacharCount = remitosRaw.filter((r) => {
    const e = (r.estado || "").toUpperCase();
    return e === "EMITIDO" || e === "EN_PREPARACION";
  }).length;

  const bultosPorVerificarCount = remitosRaw.filter((r) => {
    const e = (r.estado || "").toUpperCase();
    return e === "DESPACHADO" || e === "EN_TRANSITO" || e === "RECIBIDO";
  }).length;

  const remitosEnTransitoCount = remitosRaw.filter((r) => {
    const e = (r.estado || "").toUpperCase();
    return e === "DESPACHADO" || e === "EN_TRANSITO";
  }).length;

  const trabajoPendiente = {
    ordenesPorPreparar: ordenesPorPrepararCount,
    remitosPorDespachar: remitosPorDespacharCount,
    bultosPorVerificar: bultosPorVerificarCount,
    necesidadesPendientes: necesidadesRaw.length,
  };

  // 4. Métricas de tendencia semántica (FR-044)
  const criticasCount = alertasAccionables.filter((a) => a.severidad === "critica").length;

  const metricasTendencia = [
    {
      id: "criticas",
      label: "Tareas críticas",
      valor: criticasCount,
      deepLink: "/stock/alertas?urgencia=critica&estado=pendientes",
    },
    {
      id: "preparacion",
      label: "En preparación",
      valor: ordenesPorPrepararCount,
      deepLink: "/logistica/empaquetado",
    },
    {
      id: "transito",
      label: "En tránsito",
      valor: remitosEnTransitoCount,
      deepLink: "/logistica/remitos",
    },
    {
      id: "verificar",
      label: "Por verificar",
      valor: bultosPorVerificarCount,
      deepLink: "/logistica/recepcion",
    },
  ];

  const ultimosMovimientos = movimientosRaw.map((evento) => {
    const fecha = evento.fecha_hora ? new Date(evento.fecha_hora) : null;
    const sede = ubicMap.get(evento.destino_id || evento.origen_id);
    const prefijo = evento.tipo_entidad === "ORDEN" ? "OR" : evento.tipo_entidad === "BULTO" ? "BU" : evento.tipo_entidad;
    return {
      id: evento.id,
      hora: fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "Sin hora",
      entidad: `${prefijo}-${String(evento.entidad_id).padStart(6, "0")}`,
      accion: String(evento.accion || "Evento").replaceAll("_", " "),
      responsableNombre: evento.actor || "Sistema",
      sede: sede?.nombre || "Red logística",
      consecuencia: evento.motivo_o_evidencia || `${evento.estado_anterior || "Sin estado"} → ${evento.estado_nuevo}`,
    };
  });

  // 6. Notificaciones operativas para NotificationPanel
  const notifications = alertasAccionables.map((a) => ({
    id: a.id,
    title: a.titulo,
    description: a.descripcion,
    category: a.categoria,
    timestamp: a.timestamp,
    read: readNotificationIds.has(a.id),
    entity: a.entidad,
    actionLabel: a.accionLabel,
    actionRuta: a.accionRuta,
    accionTipo: a.accionTipo,
    accionParametros: a.accionParametros,
  }));

  const marcarNotificacionLeida = (notifId) => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      next.add(notifId);
      return next;
    });
  };

  const marcarTodasNotificacionesLeidas = () => {
    setReadNotificationIds(new Set(notifications.map((n) => n.id)));
  };

  return {
    loading,
    error,
    refresh: () => fetchDashboardData(false),
    freshnessSeconds,
    isStale,
    lastUpdated,
    redInfo: {
      centrosActivos: cdsActivos,
      localesActivos: localesActivos,
      centrosLabel,
      localesLabel,
    },
    alertasAccionables,
    trabajoPendiente,
    metricasTendencia,
    ultimosMovimientos,
    notifications,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas,
  };
}

export default useAdminDashboard;
