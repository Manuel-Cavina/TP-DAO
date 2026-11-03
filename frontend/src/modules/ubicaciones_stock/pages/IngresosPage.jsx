import React from "react";
import { Navigate } from "react-router-dom";

/**
 * IngresosPage ahora unifica su operativa dentro de StockPage con el Drawer de Restock de Casa Central.
 * Mantiene la compatibilidad de ruta redirigiendo a la matriz de stock.
 */
export function IngresosPage() {
  return <Navigate to="/stock/stock" replace />;
}

export default IngresosPage;
