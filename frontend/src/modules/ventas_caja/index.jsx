import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { VentasCajaPage } from "./pages/VentasCajaPage";

export const VENTAS_NAV = {
  key: "ventas_caja",
  label: "Ventas y caja (POS)",
  icon: "credit-card",
  path: "/ventas",
};

export function VentasCajaRoutes() {
  return (
    <Routes>
      <Route index element={<VentasCajaPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}

export { VentasCajaPage };
export * from "./services";
export * from "./hooks/useVentasCaja";
