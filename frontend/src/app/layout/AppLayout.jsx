import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell, TASK_GROUPS } from "../../shared/components/AppShell";
import { ScreenTransition } from "../../shared/components/Motion";
import { ErrorBoundary } from "../providers/ErrorBoundary";
import { useSede } from "../providers/SedeProvider";
import { useAuth } from "../auth/AuthProvider";

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { sedes, sedeId, setSedeId } = useSede();
  const { user } = useAuth();
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Derive active task group and active task sub-item from current pathname
  let activeGroup = null;
  let activeItem = null;

  for (const group of TASK_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path + "/"))) {
        activeGroup = group;
        activeItem = item;
        break;
      }
    }
    if (activeGroup) break;
  }

  if (!activeGroup) {
    if (pathname.startsWith("/catalogo")) activeGroup = TASK_GROUPS.find((g) => g.id === "catalogo");
    else if (pathname.startsWith("/stock/ubicaciones") || pathname.startsWith("/red")) activeGroup = TASK_GROUPS.find((g) => g.id === "red");
    else if (pathname.startsWith("/stock")) activeGroup = TASK_GROUPS.find((g) => g.id === "inventario");
    else if (pathname.startsWith("/logistica")) activeGroup = TASK_GROUPS.find((g) => g.id === "distribucion");
    else if (pathname.startsWith("/ventas")) activeGroup = TASK_GROUPS.find((g) => g.id === "ventas");
    else if (pathname.startsWith("/reportes")) activeGroup = TASK_GROUPS.find((g) => g.id === "auditoria");
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
      currentPath={pathname}
      routeTitle={routeTitle}
      onNavigate={(path) => navigate(path)}
      activeModule={activeGroup?.id || "inventario"}
      locations={sedes}
      activeLocation={sedeId}
      onSelectLocation={setSedeId}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      flowContextBadge={flowContextBadge}
      operatorName={user?.displayName || user?.name || "Administrador"}
      operatorRole={user?.role === "ADMIN" ? "Administrador" : "Operador"}
    >
      <ErrorBoundary resetKey={pathname}>
        <ScreenTransition screenKey={pathname}>
          <Outlet context={{ sedeId, sedes, isMultiNodeFlow }} />
        </ScreenTransition>
      </ErrorBoundary>
    </AppShell>
  );
}

export default AppLayout;
