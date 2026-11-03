import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ReportesPage } from "./pages/ReportesPage";
import { ReporteImprimiblePage } from "./pages/ReporteImprimiblePage";
import { ReportesAnaliticosPage } from "./pages/ReportesAnaliticosPage";
import { ReportesHeader } from "./components/ReportesHeader";
import { ReporteExportToolbar } from "./components/ReporteExportToolbar";
import { PlotlyRenderer } from "./components/PlotlyRenderer";
import { ModalFichaStock } from "./components/ModalFichaStock";
import { ModalAuditoriaMerma } from "./components/ModalAuditoriaMerma";
import { reportesService } from "./services/reportesService";
import { useReportes } from "./hooks/useReportes";

export {
  ReportesPage,
  ReporteImprimiblePage,
  ReportesAnaliticosPage,
  ReportesHeader,
  ReporteExportToolbar,
  PlotlyRenderer,
  ModalFichaStock,
  ModalAuditoriaMerma,
  reportesService,
  useReportes,
};

export function ReportesRoutes() {
  return (
    <Routes>
      <Route index element={<ReportesPage initialReport="ventas" />} />
      <Route path="ventas" element={<ReportesPage initialReport="ventas" />} />
      <Route path="productos" element={<ReportesPage initialReport="productos" />} />
      <Route path="transito" element={<ReportesPage initialReport="transito" />} />
      <Route path="stock" element={<ReportesPage initialReport="stock" />} />
      <Route path="mermas" element={<ReportesPage initialReport="mermas" />} />
      <Route path="imprimible" element={<ReporteImprimiblePage />} />
      <Route path="*" element={<Navigate to="ventas" replace />} />
    </Routes>
  );
}

export default ReportesRoutes;
