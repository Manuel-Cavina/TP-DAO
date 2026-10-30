import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { OperationalLayout } from "./layout/OperationalLayout";
import { LoginPage } from "./auth/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AdminDashboardPage } from "./dashboard/AdminDashboardPage";
import { OperatorDashboardPage } from "./dashboard/OperatorDashboardPage";
import { CatalogoRoutes } from "../modules/catalogo";
import { StockRoutes } from "../modules/ubicaciones_stock";
import { LogisticaRoutes } from "../modules/logistica";
import { VentasCajaRoutes } from "../modules/ventas_caja";
import { ReportesRoutes } from "../modules/reportes";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Ruta operativa movil protegida para OPERADOR (y ADMIN por herencia) */}
      <Route
        path="/operador"
        element={
          <ProtectedRoute requiredRole="OPERADOR">
            <OperatorDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/operator" element={<Navigate to="/operador" replace />} />

      <Route element={<ProtectedRoute requiredRole="OPERADOR" />}>
        <Route element={<OperationalLayout />}>
          <Route path="logistica/*" element={<LogisticaRoutes />} />
        </Route>
      </Route>

      {/* Rutas administrativas protegidas para ADMIN */}
      <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="catalogo/*" element={<CatalogoRoutes />} />
          <Route path="stock/*" element={<StockRoutes />} />
          <Route path="red/*" element={<Navigate to="/stock/ubicaciones" replace />} />
          <Route path="ventas/*" element={<VentasCajaRoutes />} />
          <Route path="reportes/*" element={<ReportesRoutes />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default AppRoutes;
