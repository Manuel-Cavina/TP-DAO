import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ requiredRole, children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="stocky-loading-screen" role="status" aria-live="polite">
        <span className="stocky-spinner" aria-hidden="true" />
        <p className="muted">Cargando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const userRole = String(user.role || "").toUpperCase();
    const neededRole = String(requiredRole).toUpperCase();
    const hasRole = userRole === "ADMIN" || userRole === neededRole;

    if (!hasRole) {
      const destination = userRole === "OPERADOR" ? "/operador" : "/dashboard";
      return <Navigate to={destination} replace />;
    }
  }

  return children ? children : <Outlet />;
}

export default ProtectedRoute;
