import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { StockPage } from "./pages/StockPage";
import { IngresosPage } from "./pages/IngresosPage";
import { AlertasPage } from "./pages/AlertasPage";
import { UbicacionesPage } from "./pages/UbicacionesPage";

export const STOCK_NAV = {
  key: "ubicaciones_stock",
  label: "Ubicaciones y stock",
  icon: "warehouse",
  path: "/stock",
};

export function StockRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="stock" replace />} />
      <Route path="stock" element={<StockPage />} />
      <Route path="ingresos" element={<IngresosPage />} />
      <Route path="alertas" element={<AlertasPage />} />
      <Route path="ubicaciones" element={<UbicacionesPage />} />
      <Route path="*" element={<Navigate to="stock" replace />} />
    </Routes>
  );
}

export { StockPage, IngresosPage, AlertasPage, UbicacionesPage };
export * from "./services";
export * from "./hooks/useUbicaciones";
export * from "./hooks/useStockMatriz";
export * from "./hooks/useAlertasStock";
export * from "./hooks/useIngresoCd";
