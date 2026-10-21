import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProductosPage } from "./pages/ProductosPage";
import { CategoriasPage } from "./pages/CategoriasPage";
import { ProveedoresPage } from "./pages/ProveedoresPage";
import { CatalogoPage } from "./pages/CatalogoPage";

export const CATALOGO_NAV = {
  key: "catalogo",
  label: "Catálogo",
  icon: "package",
  path: "/catalogo",
};

export function CatalogoRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="productos" replace />} />
      <Route path="productos" element={<ProductosPage />} />
      <Route path="categorias" element={<CategoriasPage />} />
      <Route path="proveedores" element={<ProveedoresPage />} />
      <Route path="precios" element={<Navigate to="productos" replace />} />
      <Route path="*" element={<Navigate to="productos" replace />} />
    </Routes>
  );
}

export { ProductosPage, CategoriasPage, ProveedoresPage, CatalogoPage };
export * from "./services";
export * from "./hooks/useProductos";
export * from "./hooks/useProveedores";
export * from "./hooks/useCategorias";
