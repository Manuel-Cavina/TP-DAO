import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../reportes.css";
import "../reportes-details.css";
import {
  SegmentedControl,
  Alert,
  Button,
  Icon,
} from "../../../shared";
import { useReportes } from "../hooks/useReportes";
import { ReportesHeader } from "../components/ReportesHeader";
import { ReporteExportToolbar } from "../components/ReporteExportToolbar";
import { ModalFichaStock } from "../components/ModalFichaStock";
import { ModalAuditoriaMerma } from "../components/ModalAuditoriaMerma";
import { ReporteR1StockView } from "../components/ReporteR1StockView";
import { ReporteR2MermasView } from "../components/ReporteR2MermasView";
import { PrintReport } from "../components/PrintReport";

export function ReportesPage({ initialReport = "r1" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    activeReport,
    setActiveReport,

    // R1
    r1Data,
    loadingR1,
    errorR1,
    r1UbicacionId,
    setR1UbicacionId,
    r1CategoriaId,
    setR1CategoriaId,
    r1SoloBajoMinimo,
    setR1SoloBajoMinimo,

    // R2
    r2Data,
    loadingR2,
    errorR2,
    r2FechaInicio,
    setR2FechaInicio,
    r2FechaFin,
    setR2FechaFin,
    r2LocalDestinoId,
    setR2LocalDestinoId,

    // Opciones
    ubicaciones,
    categorias,

    // Drill downs
    isR1ModalOpen,
    selectedProductoId,
    r1DrillDownData,
    loadingR1DrillDown,
    openR1DrillDown,
    closeR1DrillDown,

    isR2ModalOpen,
    selectedBultoId,
    r2DrillDownData,
    loadingR2DrillDown,
    openR2DrillDown,
    closeR2DrillDown,

    reloadAll,
  } = useReportes();

  // Sincronizar ruta actual con el reporte activo
  useEffect(() => {
    if (location.pathname.endsWith("/mermas") && activeReport !== "r2") {
      setActiveReport("r2");
    } else if (location.pathname.endsWith("/stock") && activeReport !== "r1") {
      setActiveReport("r1");
    } else if (initialReport && activeReport !== initialReport && !location.pathname.includes("/reportes/")) {
      setActiveReport(initialReport);
    }
  }, [location.pathname, initialReport, activeReport, setActiveReport]);

  const handleReportChange = (val) => {
    setActiveReport(val);
    navigate(val === "r2" ? "/reportes/mermas" : "/reportes/stock");
  };

  const r1Items = r1Data?.items || [];
  const r1Resumen = r1Data?.resumen;

  const r2Bultos = r2Data?.bultos_rechazados || [];
  const r2Resumen = r2Data?.resumen;

  const getFiltrosDescripcion = () => {
    if (activeReport === "r1") {
      const ub = ubicaciones.find((u) => String(u.id) === String(r1UbicacionId))?.nombre || "Todas las sedes";
      const cat = categorias.find((c) => String(c.id) === String(r1CategoriaId))?.nombre || "Todas las categorías";
      return `Ubicación: ${ub} | Categoría: ${cat} | Solo bajo mínimo: ${r1SoloBajoMinimo ? "Sí" : "No"}`;
    }
    const loc = ubicaciones.find((u) => String(u.id) === String(r2LocalDestinoId))?.nombre || "Todos los locales receptores";
    const fIni = r2FechaInicio || "Sin límite inferior";
    const fFin = r2FechaFin || "Sin límite superior";
    return `Período: ${fIni} al ${fFin} | Destino: ${loc}`;
  };

  const activeFiltersObj = activeReport === "r1" ? {
    ubicacion_id: r1UbicacionId,
    categoria_id: r1CategoriaId,
    solo_bajo_minimo: r1SoloBajoMinimo,
  } : {
    fecha_inicio: r2FechaInicio,
    fecha_fin: r2FechaFin,
    local_destino_id: r2LocalDestinoId,
  };

  return (
    <div className="stocky-reports-page">
      <PrintReport
        reportKey={activeReport}
        items={activeReport === "r1" ? r1Items : r2Bultos}
        summary={activeReport === "r1" ? r1Resumen : r2Resumen}
        filters={getFiltrosDescripcion()}
      />

      <div className="stocky-report-screen stack gap-4">
        {/* Cabecera Oficial Stocky con logo y operador */}
        <ReportesHeader
          loading={activeReport === "r1" ? loadingR1 : loadingR2}
          onRefresh={reloadAll}
        />

        {/* Pregunta operacional de auditoría según T038 */}
        <div className="card p-4 stocky-audit-question-card">
          <div className="row align-center gap-3">
            <div className="p-2 bg-subtle rounded-md">
              <Icon
                name={activeReport === "r1" ? "package" : "alert-triangle"}
                size={22}
                className="text-accent"
              />
            </div>
            <div>
              <h2 className="text-lg font-medium stocky-audit-question">
                {activeReport === "r1"
                  ? "¿Dónde está el stock y cuál es su valorización en la red?"
                  : "¿Dónde se originaron las mermas y violaciones de precintos?"}
              </h2>
              <p className="text-xs text-secondary">
                {activeReport === "r1"
                  ? "Dictamen operacional de existencias en CD y locales, niveles críticos bajo mínimo y valorización patrimonial."
                  : "Dictamen forense de trazabilidad de bultos despachados, precintos violados y mermas efectivizadas."}
              </p>
            </div>
          </div>
        </div>

        {/* Selector principal de Reportes estructurados como preguntas operacionales */}
        <div className="stocky-toolbar-card no-print">
          <div className="row justify-between align-center wrap gap-3">
            <SegmentedControl
              value={activeReport}
              onChange={handleReportChange}
              options={[
                {
                  value: "r1",
                  label: "Salud de stock",
                  count: r1Items.length,
                },
                {
                  value: "r2",
                  label: "Mermas y precintos",
                  count: r2Bultos.length,
                },
              ]}
            />

            <ReporteExportToolbar
              reportKey={activeReport}
              reportTitle={
                activeReport === "r1"
                  ? "R1_Salud_Stock_Valorizacion"
                  : "R2_Mermas_Precintos_Violados"
              }
              dataRows={activeReport === "r1" ? r1Items : r2Bultos}
              rawReportData={activeReport === "r1" ? r1Data : r2Data}
              activeFiltersDesc={getFiltrosDescripcion()}
              filters={activeFiltersObj}
            />
          </div>

          {/* Filtros para R1 */}
          {activeReport === "r1" && (
            <div className="stocky-filter-row pt-2 border-t border-subtle mt-3">
              <div className="stocky-filter-controls">
                <label className="text-xs text-secondary font-medium">Filtros de stock:</label>
                <select
                  className="erp-input erp-input--sm stocky-filter-select"
                  value={r1UbicacionId}
                  onChange={(e) => setR1UbicacionId(e.target.value)}
                >
                  <option value="">Todas las ubicaciones</option>
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.tipo === "CD" ? "CD" : "Local"} - {u.nombre}
                    </option>
                  ))}
                </select>

                <select
                  className="erp-input erp-input--sm stocky-filter-select"
                  value={r1CategoriaId}
                  onChange={(e) => setR1CategoriaId(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>

                <label className="row align-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={r1SoloBajoMinimo}
                    onChange={(e) => setR1SoloBajoMinimo(e.target.checked)}
                  />
                  <span className="text-danger font-medium">
                    Solo bajo mínimo (Observer)
                  </span>
                </label>

                {(r1UbicacionId || r1CategoriaId || r1SoloBajoMinimo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setR1UbicacionId("");
                      setR1CategoriaId("");
                      setR1SoloBajoMinimo(false);
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Filtros para R2 */}
          {activeReport === "r2" && (
            <div className="stocky-filter-row pt-2 border-t border-subtle mt-3">
              <div className="stocky-filter-controls">
                <label className="text-xs text-secondary font-medium">Filtros de mermas:</label>

                <div className="row align-center gap-1">
                  <span className="text-xs text-muted">Desde:</span>
                  <input
                    type="date"
                    className="erp-input erp-input--sm"
                    value={r2FechaInicio}
                    onChange={(e) => setR2FechaInicio(e.target.value)}
                  />
                </div>

                <div className="row align-center gap-1">
                  <span className="text-xs text-muted">Hasta:</span>
                  <input
                    type="date"
                    className="erp-input erp-input--sm"
                    value={r2FechaFin}
                    onChange={(e) => setR2FechaFin(e.target.value)}
                  />
                </div>

                <select
                  className="erp-input erp-input--sm stocky-filter-select"
                  value={r2LocalDestinoId}
                  onChange={(e) => setR2LocalDestinoId(e.target.value)}
                >
                  <option value="">Todos los locales de destino</option>
                  {ubicaciones
                    .filter((u) => u.tipo === "LOCAL")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        Local: {u.nombre}
                      </option>
                    ))}
                </select>

                {(r2FechaInicio || r2FechaFin || r2LocalDestinoId) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setR2FechaInicio("");
                      setR2FechaFin("");
                      setR2LocalDestinoId("");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Banner de Pregunta Operacional Clara (T038) */}
        <section className="stocky-formal-question-banner no-print">
          <div className="row justify-between align-center wrap gap-2">
            <div>
              <div className="stocky-formal-question-title">
                {activeReport === "r1"
                  ? "¿Dónde está el stock y cuál es su valorización?"
                  : "¿Dónde se originaron las mermas y violaciones de precintos?"}
              </div>
              <div className="stocky-formal-question-sub">
                {activeReport === "r1"
                  ? "Salud de stock: Auditoría integral de existencias físicas y valorización patrimonial por centro y sucursales."
                  : "Mermas y precintos: Peritaje de roturas de precinto (Regla V1) y trazabilidad forense de bultos rechazados en destino."}
              </div>
            </div>
            <span className="text-xs font-mono text-secondary">
              {activeReport === "r1" ? "Módulo de Existencias" : "Módulo Forense"}
            </span>
          </div>
        </section>

        {activeReport === "r1" && errorR1 && (
          <Alert
            tone="danger"
            title="Error al consultar Salud de Stock"
            action={
              <Button variant="secondary" size="sm" onClick={reloadAll}>
                Reintentar
              </Button>
            }
          >
            {errorR1.message || "Ocurrió una falla de red al contactar al backend."}
          </Alert>
        )}

        {activeReport === "r2" && errorR2 && (
          <Alert
            tone="danger"
            title="Error al consultar Mermas y Precintos"
            action={
              <Button variant="secondary" size="sm" onClick={reloadAll}>
                Reintentar
              </Button>
            }
          >
            {errorR2.message || "Ocurrió una falla de red al contactar al backend."}
          </Alert>
        )}

        {activeReport === "r1" && (
          <ReporteR1StockView
            r1Data={r1Data}
            loadingR1={loadingR1}
            r1Items={r1Items}
            r1Resumen={r1Resumen}
            openR1DrillDown={openR1DrillDown}
            setR1UbicacionId={setR1UbicacionId}
            setR1CategoriaId={setR1CategoriaId}
            setR1SoloBajoMinimo={setR1SoloBajoMinimo}
          />
        )}

        {activeReport === "r2" && (
          <ReporteR2MermasView
            r2Data={r2Data}
            loadingR2={loadingR2}
            r2Bultos={r2Bultos}
            r2Resumen={r2Resumen}
            openR2DrillDown={openR2DrillDown}
            setR2FechaInicio={setR2FechaInicio}
            setR2FechaFin={setR2FechaFin}
            setR2LocalDestinoId={setR2LocalDestinoId}
          />
        )}

        <ModalFichaStock
          open={isR1ModalOpen}
          onClose={closeR1DrillDown}
          productoId={selectedProductoId}
          data={r1DrillDownData}
          loading={loadingR1DrillDown}
        />

        <ModalAuditoriaMerma
          open={isR2ModalOpen}
          onClose={closeR2DrillDown}
          bultoId={selectedBultoId}
          data={r2DrillDownData}
          loading={loadingR2DrillDown}
        />
      </div>
    </div>
  );
}

export default ReportesPage;
