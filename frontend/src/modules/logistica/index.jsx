import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LogisticaPage } from "./pages/LogisticaPage";
import { CrearOrdenPage } from "./pages/CrearOrdenPage";
import { OrdenDetallePage } from "./pages/OrdenDetallePage";
import { EmpaquetadoPage } from "./pages/EmpaquetadoPage";
import { RemitoDetallePage } from "./pages/RemitoDetallePage";
import { RecepcionPage } from "./pages/RecepcionPage";
import { OperacionesPage } from "./pages/OperacionesPage";
import { BultoDetallePage } from "./pages/BultoDetallePage";
import { TrazabilidadPage } from "./pages/TrazabilidadPage";

export const LOGISTICA_NAV = {
  key: "logistica",
  label: "Logística y remitos",
  icon: "truck",
  path: "/logistica",
};

export function LogisticaRoutes() {
  return (
    <Routes>
      <Route index element={<LogisticaPage initialTab="remitos" />} />
      <Route path="remitos" element={<LogisticaPage initialTab="remitos" />} />
      <Route path="remitos/:numero" element={<RemitoDetallePage />} />
      <Route path="ordenes" element={<LogisticaPage initialTab="ordenes" />} />
      <Route path="ordenes/nueva" element={<CrearOrdenPage />} />
      <Route path="ordenes/crear" element={<CrearOrdenPage />} />
      <Route path="ordenes/:id" element={<OrdenDetallePage />} />
      <Route path="wizard" element={<CrearOrdenPage />} />
      <Route path="operaciones" element={<OperacionesPage />} />
      <Route path="kanban" element={<OperacionesPage />} />
      <Route path="bultos/:id" element={<BultoDetallePage />} />
      <Route path="trazabilidad" element={<TrazabilidadPage />} />
      <Route path="empaquetado" element={<EmpaquetadoPage />} />
      <Route path="recepcion" element={<RecepcionPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
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
};
export * from "./services";
export * from "./hooks/useRemitos";
export * from "./hooks/useOrdenes";
export * from "./hooks/useNecesidades";
export * from "./hooks/useBultoTrazabilidad";
