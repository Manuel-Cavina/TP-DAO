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
    setSelectedProductId(productoId);
    setStockModalOpen(true);
    setStockDrillDownLoading(true);
    setStockDrillDownError(null);
    try {
      const data = await reportesService.getR1DrillDown(productoId);
      setStockDrillDownData(data);
    } catch (err) {
      setStockDrillDownError(err);
    } finally {
      setStockDrillDownLoading(false);
    }
  };

  const handleOpenMermaDrillDown = async (bultoId) => {
    setSelectedBultoId(bultoId);
    setMermaModalOpen(true);
    setMermaDrillDownLoading(true);
    setMermaDrillDownError(null);
    try {
      const currentData = cacheByTab[activeReport];
      const row = currentData?.filas?.find((item) => item.bulto_id === bultoId);
      const data = await reportesService.getR2DrillDown(bultoId, row);
      setMermaDrillDownData(data);
    } catch (err) {
      setMermaDrillDownError(err);
    } finally {
      setMermaDrillDownLoading(false);
    }
  };

  const reportTitles = {
    ventas: {
      title: "Ventas e ingresos por período, local y medio de pago",
      question: "¿Cuánto vendió cada local y con qué medio de pago, neto de devoluciones?",
    },
    productos: {
      title: "Productos más vendidos y margen estimado",
      question: "¿Qué productos se venden más y cuáles dejan pérdida?",
    },
    transito: {
      title: "Tiempo de tránsito CD a locales",
      question: "¿Cuántas horas tarda un bulto desde que sale del CD hasta que llega al local?",
    },
    stock: {
      title: "¿Dónde está el stock y cuál es su valorización?",
      question: "Salud de stock: Auditoría integral de existencias físicas y valorización patrimonial por centro y sucursales.",
    },
    mermas: {
      title: "¿Dónde se originaron las mermas y violaciones de precintos?",
      question: "Mermas y precintos: Peritaje de roturas de precinto (Regla V1) y trazabilidad forense de bultos rechazados en destino.",
    },
  };

  const currentInfo = reportTitles[activeReport] || reportTitles.ventas;
  const currentReportData = cacheByTab[activeReport];

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
          loading={loading}
          onRefresh={handleGenerate}
        />

        {/* Tarjeta de contexto con pregunta estructurada */}
        <div className="card p-4">
          <h2 className="text-lg font-medium">{currentInfo.title}</h2>
          <p className="text-xs text-secondary">{currentInfo.question}</p>
        </div>

        {/* Selector unificado de los 5 reportes */}
        <div className="stocky-toolbar-card no-print">
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
          <div className="card p-5 text-center stack gap-3 align-center justify-center">
            <Icon name="chart" size={32} className="text-secondary" />
            <div className="stack gap-1">
              <h3 className="text-base font-medium text-foreground">Reporte listo para configurar</h3>
              <p className="text-xs text-secondary">
                Selecciona la temporalidad, sede y filtros requeridos en la barra superior. Luego presiona el botón para procesar los datos en vivo sin consumir consultas en vano.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              icon={<Icon name="arrow-right" size="sm" />}
            >
              Generar reporte ahora
            </Button>
          </div>
        )}

        {/* Contenido analítico generado bajo demanda */}
        {(hasGeneratedCurrentTab || loading) && !error && !hasInvalidRange && (
          <>
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
        onClose={() => setStockModalOpen(false)}
        productoId={selectedProductId}
        data={stockDrillDownData}
        loading={stockDrillDownLoading}
        error={stockDrillDownError}
        onRetry={() => handleOpenStockDrillDown(selectedProductId)}
      />

      {/* Drill-down de Peritaje Forense de Bulto y Precinto */}
      <ModalAuditoriaMerma
        open={mermaModalOpen}
        onClose={() => setMermaModalOpen(false)}
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
