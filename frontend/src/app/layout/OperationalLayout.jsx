import React, { useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, LogoutModal } from "../../shared";
import { useAuth } from "../auth/AuthProvider";
import { isOperatorPathAllowed } from "../auth/rolePolicy";
import { AppLayout } from "./AppLayout";
import { ErrorBoundary } from "../providers/ErrorBoundary";

export function OperationalLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (user?.role === "ADMIN") return <AppLayout />;
  if (!isOperatorPathAllowed(pathname)) return <Navigate to="/operador" replace />;

  const handleConfirmLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <div className="operator-workspace stack gap-4">
      <header className="row justify-between align-center wrap gap-2">
        <Button variant="secondary" onClick={() => navigate("/operador")}>Mi trabajo</Button>
        <span className="text-sm">{user?.displayName || user?.name} · Operador</span>
        <Button variant="ghost" iconLeft="log-out" onClick={() => setLogoutOpen(true)}>Cerrar sesión</Button>
      </header>
      <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      <LogoutModal
        open={logoutOpen}
        onClose={() => !loggingOut && setLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
        userName={user?.displayName || user?.name || "Operador"}
        userRole="Operador logístico"
        isBusy={loggingOut}
      />
    </div>
  );
}
