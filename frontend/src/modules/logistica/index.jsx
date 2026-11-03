import React from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { CrearOrdenPage } from "./pages/CrearOrdenPage";
import { OrdenDetallePage } from "./pages/OrdenDetallePage";
import { EmpaquetadoPage } from "./pages/EmpaquetadoPage";
import { RemitoDetallePage } from "./pages/RemitoDetallePage";
import { RecepcionPage } from "./pages/RecepcionPage";
import { OperacionesPage } from "./pages/OperacionesPage";
import { BultoDetallePage } from "./pages/BultoDetallePage";
import { TrazabilidadPage } from "./pages/TrazabilidadPage";
import { OrdenesHistorialPage } from "./pages/OrdenesHistorialPage";
import { LogisticaPage } from "./pages/LogisticaPage";

export const LOGISTICA_NAV = {
  key: "logistica",
  label: "Operaciones",
  icon: "truck",
  path: "/logistica/operaciones",
};

function LegacyEmpaquetadoRedirect() {
  const [params] = useSearchParams();
  const ordenId = params.get("ordenId");
  if (ordenId) {
    return <Navigate to={`/logistica/ordenes/${ordenId}?tab=empaque`} replace />;
  }
  return <Navigate to="/logistica/operaciones" replace />;
}

function LegacyRecepcionRedirect() {
  const [params] = useSearchParams();
  const ordenId = params.get("ordenId");
  if (ordenId) {
    return <Navigate to={`/logistica/ordenes/${ordenId}?tab=recepcion`} replace />;
  }
  return <Navigate to="/logistica/operaciones" replace />;
}

export function LogisticaRoutes() {
  return (
    <Routes>
      {/* 1. Item principal: Tablero Operativo */}
      <Route index element={<Navigate to="/logistica/operaciones" replace />} />
      <Route path="operaciones" element={<OperacionesPage />} />
      <Route path="kanban" element={<OperacionesPage />} />

      {/* 2. Item principal: Historial de Órdenes */}
      <Route path="ordenes" element={<OrdenesHistorialPage />} />
      <Route path="historial" element={<OrdenesHistorialPage />} />

      {/* Flujos integrados en Orden y Trazabilidad */}
      <Route path="ordenes/nueva" element={<CrearOrdenPage />} />
      <Route path="ordenes/crear" element={<CrearOrdenPage />} />
      <Route path="ordenes/:id" element={<OrdenDetallePage />} />
      <Route path="bultos/:id" element={<BultoDetallePage />} />
      <Route path="trazabilidad" element={<TrazabilidadPage />} />
      <Route path="remitos/:numero" element={<RemitoDetallePage />} />

      {/* Redirecciones de rutas obsoletas hacia la nueva estructura */}
      <Route path="remitos" element={<Navigate to="/logistica/operaciones" replace />} />
      <Route path="empaquetado" element={<LegacyEmpaquetadoRedirect />} />
      <Route path="recepcion" element={<LegacyRecepcionRedirect />} />
      <Route path="wizard" element={<Navigate to="/logistica/ordenes/nueva" replace />} />
      <Route path="*" element={<Navigate to="/logistica/operaciones" replace />} />
    </Routes>
  );
}

export {
  LogisticaPage,
  CrearOrdenPage,
  OrdenDetallePage,
  EmpaquetadoPage,
  RemitoDetallePage,
  RecepcionPage,
  OperacionesPage,
  BultoDetallePage,
  TrazabilidadPage,
  OrdenesHistorialPage,
};
export * from "./services";
export * from "./hooks/useRemitos";
export * from "./hooks/useOrdenes";
export * from "./hooks/useNecesidades";
export * from "./hooks/useBultoTrazabilidad";
