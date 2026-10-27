import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell, TASK_GROUPS } from "../../shared/components/AppShell";
import { ScreenTransition } from "../../shared/components/Motion";
import { ErrorBoundary } from "../providers/ErrorBoundary";
import { useAuth } from "../auth/AuthProvider";
import { useSede } from "../providers/SedeProvider";
import { useAlertasStock } from "../../modules/ubicaciones_stock/hooks/useAlertasStock";

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const fullPath = pathname + search;
  const { user } = useAuth();
  const { sedes, sedeId, setSedeId } = useSede();
  const { alertas, error: alertasError, marcarLeida } = useAlertasStock();
  const notifications = alertas.map((alerta) => ({
    id: alerta.id,
    category: "Reposición",
    title: `Stock bajo mínimo · producto #${alerta.productoId}`,
    description: `${alerta.disponible} disponible(s) · mínimo ${alerta.nivelMinimo}`,
    timestamp: alerta.fechaEmision ? new Date(alerta.fechaEmision).toLocaleString("es-AR") : "Sin fecha registrada",
    read: alerta.leida,
    entity: { type: "Stock", id: alerta.stockId },
    actionLabel: "Abrir alerta",
  }));

  // Derive active task group and active task sub-item from current pathname
  let activeGroup = null;
  let activeItem = null;

  for (const group of TASK_GROUPS) {
    for (const item of group.items) {
      const itemBase = item.path.split("?")[0];
      const isExact = item.path.includes("?") ? fullPath === item.path : pathname === item.path;
      const isPrefix = itemBase !== "/" && itemBase !== "/logistica" && pathname.startsWith(itemBase + "/");
      if (isExact || isPrefix) {
        activeGroup = group;
        activeItem = item;
        break;
      }
    }
    if (activeGroup) break;
  }

  if (!activeGroup) {
    if (pathname.startsWith("/catalogo")) activeGroup = TASK_GROUPS.find((g) => g.id === "maestros");
    else if (pathname.startsWith("/stock/ubicaciones") || pathname.startsWith("/red")) activeGroup = TASK_GROUPS.find((g) => g.id === "maestros");
    else if (pathname.startsWith("/stock")) activeGroup = TASK_GROUPS.find((g) => g.id === "inventario");
    else if (pathname.startsWith("/logistica")) activeGroup = TASK_GROUPS.find((g) => g.id === "distribucion");
    else if (pathname.startsWith("/ventas")) activeGroup = TASK_GROUPS.find((g) => g.id === "ventas");
    else if (pathname.startsWith("/reportes")) activeGroup = TASK_GROUPS.find((g) => g.id === "control");
    else if (pathname === "/dashboard") activeGroup = TASK_GROUPS.find((g) => g.id === "inicio");
  }

  const routeTitle =
    pathname === "/dashboard"
      ? "Panel de control"
      : activeGroup && activeItem
      ? `${activeGroup.label} · ${activeItem.label}`
      : activeGroup
      ? activeGroup.label
      : "Stocky ERP";

  // Identificar si la ruta es un flujo operativo con origen y destino explícitos
  // para no imponer una sede global única como restricción obligatoria
  const isMultiNodeFlow =
    pathname.startsWith("/logistica") ||
    pathname.startsWith("/catalogo") ||
    pathname.startsWith("/stock/ubicaciones") ||
    pathname.startsWith("/red");

  const flowContextBadge = isMultiNodeFlow
    ? "Sede de lectura (origen y destino explícitos en operación)"
    : null;

  return (
    <AppShell
      currentPath={fullPath}
      routeTitle={routeTitle}
      onNavigate={(path) => navigate(path)}
      activeModule={activeGroup?.id || "inventario"}
      flowContextBadge={flowContextBadge}
      onSearch={(query) => navigate(`/logistica/trazabilidad?q=${encodeURIComponent(query)}`)}
      readingLocations={sedes.map((sede) => ({ value: sede.value, label: sede.label, icon: sede.icon }))}
      activeReadingLocation={sedeId ?? ""}
      onSelectReadingLocation={setSedeId}
      notifications={notifications}
      notificationsError={alertasError}
      onMarkNotificationRead={(id) => marcarLeida(id)}
      onMarkAllNotificationsRead={() => Promise.all(notifications.filter((notification) => !notification.read).map((notification) => marcarLeida(notification.id)))}
      onResolveNotification={(notification) => navigate(`/stock/alertas?stockId=${notification.entity.id}`)}
      operatorName={user?.displayName || user?.name || "Administrador"}
      operatorRole={user?.role === "ADMIN" ? "Administrador" : "Operador"}
    >
      <ErrorBoundary resetKey={pathname}>
        <ScreenTransition screenKey={pathname}>
          <Outlet context={{ isMultiNodeFlow }} />
        </ScreenTransition>
      </ErrorBoundary>
    </AppShell>
  );
}

export default AppLayout;
