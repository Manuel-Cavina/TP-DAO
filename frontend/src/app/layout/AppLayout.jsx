import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../../shared/components/AppShell";
import { matchNavigation } from "../../shared/lib/navigation";
import { ScreenTransition } from "../../shared/components/Motion";
import { ErrorBoundary } from "../providers/ErrorBoundary";
import { useAuth } from "../auth/AuthProvider";
import { useAlertasStock } from "../../modules/ubicaciones_stock/hooks/useAlertasStock";

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const fullPath = pathname + search;
  const { user, logout } = useAuth();
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

  const navigation = matchNavigation(fullPath);
  const routeTitle = navigation ? `${navigation.group.label} · ${navigation.item.label}` : "Stocky ERP";

  const isMultiNodeFlow =
    pathname.startsWith("/logistica") ||
    pathname.startsWith("/catalogo") ||
    pathname.startsWith("/stock/ubicaciones") ||
    pathname.startsWith("/red");

  return (
    <AppShell
      currentPath={fullPath}
      routeTitle={routeTitle}
      onNavigate={(path) => navigate(path)}
      activeModule={navigation?.group.id || "inicio"}
      onSearch={(query) => navigate(`/logistica/trazabilidad?q=${encodeURIComponent(query)}`)}
      notifications={notifications}
      notificationsError={alertasError}
      onMarkNotificationRead={(id) => marcarLeida(id)}
      onMarkAllNotificationsRead={() => Promise.all(notifications.filter((notification) => !notification.read).map((notification) => marcarLeida(notification.id)))}
      onResolveNotification={(notification) => navigate(`/stock/alertas?stockId=${notification.entity.id}`)}
      operatorName={user?.displayName || user?.name || "Administrador"}
      operatorRole={user?.role === "ADMIN" ? "Administrador" : "Operador"}
      onLogout={async () => {
        await logout();
        navigate("/login", { replace: true });
      }}
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
