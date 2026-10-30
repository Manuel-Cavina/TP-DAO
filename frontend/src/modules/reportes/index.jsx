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
      <Route index element={<ReportesPage initialReport="r1" />} />
      <Route path="stock" element={<ReportesPage initialReport="r1" />} />
      <Route path="mermas" element={<ReportesPage initialReport="r2" />} />
      <Route path="ventas" element={<ReportesAnaliticosPage />} />
      <Route path="productos" element={<ReportesAnaliticosPage />} />
      <Route path="transito" element={<ReportesAnaliticosPage />} />
      <Route path="imprimible" element={<ReporteImprimiblePage />} />
      <Route path="*" element={<Navigate to="stock" replace />} />
    </Routes>
  );
}

export default ReportesRoutes;
