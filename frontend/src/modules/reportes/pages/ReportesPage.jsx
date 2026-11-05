import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../reportes.css";
import "../reportes-details.css";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Alert } from "../../../shared/components/Feedback";
import { Button } from "../../../shared/components/Button";
import { Icon } from "../../../shared/components/Icon";
import { ReportesHeader } from "../components/ReportesHeader";
import { ReportesFiltrosBar } from "../components/ReportesFiltrosBar";
import { ReportesKpiStrip } from "../components/ReportesKpiStrip";
import { ReportesGraficosView } from "../components/ReportesGraficosView";
import { ReportesTableView } from "../components/ReportesTableView";
import { ModalFichaStock } from "../components/ModalFichaStock";
import { ModalAuditoriaMerma } from "../components/ModalAuditoriaMerma";
import { PrintReport } from "../components/PrintReport";
import { reportesUnifiedService, presets } from "../services/reportesUnifiedService";
import { reportesService } from "../services/reportesService";

const normalizeKey = (k) => {
  if (k === "r1" || k === "stock") return "stock";
  if (k === "r2" || k === "mermas") return "mermas";
  if (k === "productos") return "productos";
  if (k === "transito") return "transito";
  return "ventas";
};

const keyToPath = (k) => `/reportes/${k}`;

export function ReportesPage({ initialReport = "ventas" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKeyFromUrl = () => {
    const parts = location.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (["ventas", "productos", "transito", "stock", "mermas"].includes(last)) {
      return last;
    }
    return normalizeKey(initialReport);
  };

  const [activeReport, setActiveReport] = useState(activeKeyFromUrl);
  const [activePreset, setActivePreset] = useState("30d");

  // Estado para saber si el usuario ya tocó "Generar reporte" en cada pestaña
  const [generatedTabs, setGeneratedTabs] = useState({
    ventas: false,
    productos: false,
    transito: false,
    stock: false,
    mermas: false,
  });

  // Parámetros en borrador que el usuario ingresa
  const [draftParams, setDraftParams] = useState({
    desde: presets.hace30Dias(),
    hasta: presets.hoy(),
    localId: "",
    ubicacionId: "",
    categoriaId: "",
    soloBajoMinimo: false,
    top: 10,
  });

  // Parámetros aplicados por pestaña
  const [appliedParamsByTab, setAppliedParamsByTab] = useState({});

  // Caché de datos por pestaña
  const [cacheByTab, setCacheByTab] = useState({});

  // Maestros de combos
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);

  // Estado de carga y error activo
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modales de drill-down
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [stockDrillDownData, setStockDrillDownData] = useState(null);
  const [stockDrillDownLoading, setStockDrillDownLoading] = useState(false);
  const [stockDrillDownError, setStockDrillDownError] = useState(null);

  const [mermaModalOpen, setMermaModalOpen] = useState(false);
  const [selectedBultoId, setSelectedBultoId] = useState(null);
  const [mermaDrillDownData, setMermaDrillDownData] = useState(null);
  const [mermaDrillDownLoading, setMermaDrillDownLoading] = useState(false);
  const [mermaDrillDownError, setMermaDrillDownError] = useState(null);

  const queryRequestId = useRef(0);
  const stockDetailRequestId = useRef(0);
  const mermaDetailRequestId = useRef(0);

  useEffect(() => () => {
    stockDetailRequestId.current += 1;
    mermaDetailRequestId.current += 1;
  }, []);

  // Sincronizar ruta con activeReport
  useEffect(() => {
    const current = activeKeyFromUrl();
    if (current !== activeReport) {
      setActiveReport(current);
    }
  }, [location.pathname]);

  // Cargar maestros de ubicaciones y categorías
  useEffect(() => {
    let mounted = true;
    Promise.all([
      reportesUnifiedService.getLocations(),
      reportesUnifiedService.getCategories(),
    ])
      .then(([locs, cats]) => {
        if (!mounted) return;
        setLocations(locs);
        setCategories(cats);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Función ejecutora que SOLO se ejecuta al hacer clic en "Generar reporte"
  const executeReport = useCallback(
    async (repKey, paramsToUse) => {
      const thisReq = ++queryRequestId.current;
      setLoading(true);
      setError(null);

      try {
        let result;
        if (repKey === "ventas") {
          result = await reportesUnifiedService.getVentas(paramsToUse);
        } else if (repKey === "productos") {
          result = await reportesUnifiedService.getProductos(paramsToUse);
        } else if (repKey === "transito") {
          result = await reportesUnifiedService.getTransito(paramsToUse);
        } else if (repKey === "stock") {
          result = await reportesUnifiedService.getStock(paramsToUse);
        } else if (repKey === "mermas") {
          result = await reportesUnifiedService.getMermas(paramsToUse);
        }

        if (thisReq !== queryRequestId.current) return;
        setCacheByTab((prev) => ({ ...prev, [repKey]: result }));
        setAppliedParamsByTab((prev) => ({ ...prev, [repKey]: { ...paramsToUse } }));
        setGeneratedTabs((prev) => ({ ...prev, [repKey]: true }));
        setLoading(false);
      } catch (err) {
        if (thisReq !== queryRequestId.current) return;
        setError(err);
        setLoading(false);
      }
    },
    []
  );

  const handleTabChange = (nextKey) => {
    setActiveReport(nextKey);
    navigate(keyToPath(nextKey));
  };

  const handleApplyPreset = (presetKey) => {
    setActivePreset(presetKey);
    let nextDesde = draftParams.desde;
    let nextHasta = presets.hoy();

    if (presetKey === "30d") nextDesde = presets.hace30Dias();
    else if (presetKey === "7d") nextDesde = presets.hace7Dias();
    else if (presetKey === "mes") nextDesde = presets.inicioMes();
    else if (presetKey === "anio") nextDesde = presets.inicioAnio();

    setDraftParams((prev) => ({ ...prev, desde: nextDesde, hasta: nextHasta }));
  };

  const handleGenerate = () => {
    executeReport(activeReport, draftParams);
  };

  const handleReset = () => {
    const defaultParams = {
      desde: presets.hace30Dias(),
      hasta: presets.hoy(),
      localId: "",
      ubicacionId: "",
      categoriaId: "",
      soloBajoMinimo: false,
      top: 10,
    };
    setActivePreset("30d");
    setDraftParams(defaultParams);
    setGeneratedTabs((prev) => ({ ...prev, [activeReport]: false }));
    setCacheByTab((prev) => {
      const copy = { ...prev };
      delete copy[activeReport];
      return copy;
    });
  };

  // Comparar si draftParams difiere de los parámetros aplicados para esta pestaña
  const currentApplied = appliedParamsByTab[activeReport];
  const hasGeneratedCurrentTab = Boolean(generatedTabs[activeReport]);
  const isDirty = Boolean(
    hasGeneratedCurrentTab &&
      currentApplied &&
      (draftParams.desde !== currentApplied.desde ||
        draftParams.hasta !== currentApplied.hasta ||
        draftParams.localId !== currentApplied.localId ||
        draftParams.ubicacionId !== currentApplied.ubicacionId ||
        draftParams.categoriaId !== currentApplied.categoriaId ||
        draftParams.soloBajoMinimo !== currentApplied.soloBajoMinimo ||
        draftParams.top !== currentApplied.top)
  );

  const hasInvalidRange = Boolean(
    activeReport !== "stock" &&
      draftParams.desde &&
      draftParams.hasta &&
      draftParams.desde > draftParams.hasta
  );

  // Apertura de drill-downs
  const handleOpenStockDrillDown = async (productoId) => {
    const requestId = ++stockDetailRequestId.current;
    setSelectedProductId(productoId);
    setStockModalOpen(true);
    setStockDrillDownLoading(true);
    setStockDrillDownError(null);
    setStockDrillDownData(null);
    try {
      const data = await reportesService.getR1DrillDown(productoId);
      if (requestId !== stockDetailRequestId.current) return;
      setStockDrillDownData(data);
    } catch (err) {
      if (requestId !== stockDetailRequestId.current) return;
      setStockDrillDownError(err);
    } finally {
      if (requestId === stockDetailRequestId.current) setStockDrillDownLoading(false);
    }
  };

  const handleOpenMermaDrillDown = async (bultoId) => {
    const requestId = ++mermaDetailRequestId.current;
    setSelectedBultoId(bultoId);
    setMermaModalOpen(true);
    setMermaDrillDownLoading(true);
    setMermaDrillDownError(null);
    setMermaDrillDownData(null);
    try {
      const currentData = cacheByTab[activeReport];
      const row = currentData?.filas?.find((item) => item.bulto_id === bultoId);
      const data = await reportesService.getR2DrillDown(bultoId, row);
      if (requestId !== mermaDetailRequestId.current) return;
      setMermaDrillDownData(data);
    } catch (err) {
      if (requestId !== mermaDetailRequestId.current) return;
      setMermaDrillDownError(err);
    } finally {
      if (requestId === mermaDetailRequestId.current) setMermaDrillDownLoading(false);
    }
  };

  const reportTitles = {
    ventas: {
      title: "Ventas e ingresos",
      question: "¿Cuánto vendió cada local y con qué medio de pago, neto de devoluciones?",
    },
    productos: {
      title: "Productos y margen",
      question: "¿Qué productos se venden más y cuáles dejan pérdida?",
    },
    transito: {
      title: "Tiempo de tránsito",
      question: "¿Cuántas horas tarda un bulto desde que sale del CD hasta que llega al local?",
    },
    stock: {
      title: "Stock y valorización",
      question: "¿Dónde está el stock y cuál es su valorización?",
    },
    mermas: {
      title: "Mermas y precintos",
      question: "¿Dónde se originaron las mermas y violaciones de precintos?",
    },
  };

  const currentInfo = reportTitles[activeReport] || reportTitles.ventas;
  const currentReportData = cacheByTab[activeReport];
  const appliedLocationId = activeReport === "stock" ? currentApplied?.ubicacionId : currentApplied?.localId;
  const appliedLocation = locations.find((item) => String(item.id) === String(appliedLocationId));
  const appliedCategory = categories.find((item) => String(item.id) === String(currentApplied?.categoriaId));

  return (
    <div className="stocky-reports-page">
      <PrintReport
        reportKey={activeReport === "stock" ? "r1" : "r2"}
        items={currentReportData?.filas || []}
        summary={currentReportData?.totales || {}}
        filters={`Reporte: ${activeReport}`}
        generatedAt={new Date().toISOString()}
      />

      <div className="stocky-report-screen stack gap-4">
        {/* Cabecera Oficial Stocky con verificación de operador */}
        <ReportesHeader
          title={currentInfo.title}
          description={currentInfo.question}
        />

        {/* Selector unificado de los 5 reportes */}
        <div className="stocky-report-switcher no-print">
          <SegmentedControl
            ariaLabel="Selección de reporte gerencial"
            value={activeReport}
            onChange={handleTabChange}
            options={[
              { value: "ventas", label: "Ventas e ingresos" },
              { value: "productos", label: "Más vendidos y margen" },
              { value: "transito", label: "Tiempo de tránsito" },
              { value: "stock", label: "Salud de stock" },
              { value: "mermas", label: "Mermas y precintos" },
            ]}
          />
        </div>

        {/* Barra de configuración de parámetros: primero se definen los datos */}
        <ReportesFiltrosBar
          reportKey={activeReport}
          draftParams={draftParams}
          setDraftParams={setDraftParams}
          onApplyPreset={handleApplyPreset}
          activePreset={activePreset}
          locations={locations}
          categories={categories}
          onGenerate={handleGenerate}
          onReset={handleReset}
          loading={loading}
          isDirty={isDirty}
          hasInvalidRange={hasInvalidRange}
        />

        {/* Alerta de rango inválido */}
        {hasInvalidRange && (
          <Alert
            tone="warning"
            title="Rango de fechas inválido"
            description="La fecha inicial no puede ser posterior a la fecha final. Ajusta las fechas para poder generar el reporte."
          />
        )}

        {/* Alerta de error en la consulta */}
        {error && !hasInvalidRange && (
          <Alert
            tone="danger"
            title="No se pudo cargar el reporte"
            description={error.message || "Ocurrió un error al procesar la solicitud."}
            action={
              <Button variant="secondary" size="sm" onClick={handleGenerate}>
                Reintentar
              </Button>
            }
          />
        )}

        {/* Estado pendiente previo: antes de tocar 'Generar reporte' */}
        {!hasGeneratedCurrentTab && !loading && !error && !hasInvalidRange && (
          <div className="stocky-report-empty row gap-3 align-center">
            <Icon name="chart" size={24} className="text-secondary" />
            <div className="stack gap-1">
              <h3 className="text-base font-medium text-foreground">Reporte listo para configurar</h3>
              <p className="text-xs text-secondary">
                Define el período y la sede. Genera el reporte para consultar los resultados.
              </p>
            </div>
          </div>
        )}

        {/* Contenido analítico generado bajo demanda */}
        {(hasGeneratedCurrentTab || loading) && !error && !hasInvalidRange && (
          <>
            {currentApplied && (
              <div className="stocky-applied-scope" role="status">
                <strong>Resultado generado</strong>
                <span>{appliedLocation?.nombre || (appliedLocationId ? `Sede #${appliedLocationId}` : "Todas las sedes")}</span>
                {activeReport !== "stock" && <span className="tabular-nums">{currentApplied.desde} al {currentApplied.hasta}</span>}
                {activeReport === "stock" && <span>{appliedCategory?.nombre || "Todas las categorías"}{currentApplied.soloBajoMinimo ? " · Solo bajo mínimo" : " · Todo el stock"}</span>}
                {activeReport === "productos" && <span>Primeros {currentApplied.top} productos</span>}
                {isDirty && <span className="text-warning">Filtros nuevos sin aplicar</span>}
              </div>
            )}
            <ReportesKpiStrip
              kpis={currentReportData?.kpis || []}
              loading={loading}
            />

            <ReportesGraficosView
              graficoPrincipal={currentReportData?.grafico}
              graficoComplementario={currentReportData?.graficoComplementario}
              loading={loading}
            />

            <ReportesTableView
              reportKey={activeReport}
              rows={currentReportData?.filas || []}
              loading={loading}
              error={error}
              onRetry={handleGenerate}
              onOpenStockDrillDown={handleOpenStockDrillDown}
              onOpenMermaDrillDown={handleOpenMermaDrillDown}
            />
          </>
        )}
      </div>

      {/* Drill-down de Ficha de Stock Multisede */}
      <ModalFichaStock
        open={stockModalOpen}
        onClose={() => { stockDetailRequestId.current += 1; setStockModalOpen(false); }}
        productoId={selectedProductId}
        data={stockDrillDownData}
        loading={stockDrillDownLoading}
        error={stockDrillDownError}
        onRetry={() => handleOpenStockDrillDown(selectedProductId)}
      />

      {/* Drill-down de Peritaje Forense de Bulto y Precinto */}
      <ModalAuditoriaMerma
        open={mermaModalOpen}
        onClose={() => { mermaDetailRequestId.current += 1; setMermaModalOpen(false); }}
        bultoId={selectedBultoId}
        data={mermaDrillDownData}
        loading={mermaDrillDownLoading}
        error={mermaDrillDownError}
        onRetry={() => handleOpenMermaDrillDown(selectedBultoId)}
      />
    </div>
  );
}

export default ReportesPage;
