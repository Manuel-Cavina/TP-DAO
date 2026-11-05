import React from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../../shared/components/AppShell";
import { OPERATOR_TASK_GROUPS } from "../../shared/lib/navigation";
import { useAuth } from "../auth/AuthProvider";
import { isOperatorPathAllowed } from "../auth/rolePolicy";
import { AppLayout } from "./AppLayout";
import { ErrorBoundary } from "../providers/ErrorBoundary";

export function OperationalLayout() {
  const { user, logout } = useAuth();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  if (user?.role === "ADMIN") return <AppLayout />;
  if (!isOperatorPathAllowed(pathname)) return <Navigate to="/operador" replace />;

  return (
    <AppShell
      currentPath={pathname + search}
      taskGroups={OPERATOR_TASK_GROUPS}
      contextLabel="Trabajo logístico asignado"
      showActivity={false}
      onNavigate={navigate}
      onSearch={(query) => navigate(`/logistica/trazabilidad?q=${encodeURIComponent(query)}`)}
      operatorName={user?.displayName || user?.name || "Operador"}
      operatorRole="Operador logístico"
      onLogout={async () => { await logout(); navigate("/login", { replace: true }); }}
    >
      <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
    </AppShell>
  );
}
