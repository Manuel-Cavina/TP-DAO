import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { reportesService } from "../services/reportesService";
import { Button } from "../../../shared/components/Button";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Skeleton } from "../../../shared/components/Feedback";
import "../reportes.css";
import "../reportes-details.css";

const money = (val) => `$${Number(val || 0).toLocaleString("es-AR")}`;

export function ReporteImprimiblePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const reportParam = searchParams.get("reporte") || "stock";
  const activeReport = reportParam === "mermas" || reportParam === "r2" ? "r2" : "r1";

  const [ubicaciones, setUbicaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emittedDate] = useState(() => new Date().toLocaleString("es-AR"));

  const ubicacionId = searchParams.get("ubicacion_id") || "";
  const categoriaId = searchParams.get("categoria_id") || "";
  const soloBajoMinimo = searchParams.get("solo_bajo_minimo") === "true";
  const fechaInicio = searchParams.get("fecha_inicio") || "";
  const fechaFin = searchParams.get("fecha_fin") || "";
  const localDestinoId = searchParams.get("local_destino_id") || "";
  const autoPrint = searchParams.get("autoPrint") === "1" || searchParams.get("autoPrint") === "true";

  // Cargar metadatos
  useEffect(() => {
    let active = true;
    Promise.all([reportesService.getUbicaciones(), reportesService.getCategorias()]).then(
      ([ubics, cats]) => {
        if (!active) return;
        setUbicaciones(ubics || []);
        setCategorias(cats || []);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  // Cargar datos del reporte seleccionado
  useEffect(() => {
    let active = true;
    setLoading(true);

    if (activeReport === "r1") {
      const params = {};
      if (ubicacionId) params.ubicacion_id = Number(ubicacionId);
      if (categoriaId) params.categoria_id = Number(categoriaId);
      if (soloBajoMinimo) params.solo_bajo_minimo = true;

      reportesService.getR1StockValorizacion(params).then((data) => {
        if (!active) return;
        setReportData(data);
        setLoading(false);
      });
    } else {
      const params = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      if (localDestinoId) params.local_destino_id = Number(localDestinoId);

      reportesService.getR2MermasPrecinto(params).then((data) => {
        if (!active) return;
        setReportData(data);
        setLoading(false);
      });
    }

    return () => {
      active = false;
    };
  }, [activeReport, ubicacionId, categoriaId, soloBajoMinimo, fechaInicio, fechaFin, localDestinoId]);

  // Autoprint si fue solicitado por la barra de exportación
  useEffect(() => {
    if (!loading && reportData && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading, reportData, autoPrint]);

  const filterSummary = useMemo(() => {
    if (activeReport === "r1") {
      const ub = ubicaciones.find((u) => String(u.id) === String(ubicacionId))?.nombre || "Todas las sedes";
      const cat = categorias.find((c) => String(c.id) === String(categoriaId))?.nombre || "Todas las categorías";
      const crit = soloBajoMinimo ? "Exclusivo artículos bajo mínimo" : "Todos los niveles de existencia";
      return `Ubicación: ${ub} | Categoría: ${cat} | Criterio: ${crit}`;
    }
    const loc = ubicaciones.find((u) => String(u.id) === String(localDestinoId))?.nombre || "Todos los locales receptores";
    const fIni = fechaInicio || "Sin límite inferior";
    const fFin = fechaFin || "Sin límite superior";
    return `Período: ${fIni} al ${fFin} | Destino auditado: ${loc} | Tipificación: Regla V1 (Rechazo por merma)`;
  }, [activeReport, ubicaciones, categorias, ubicacionId, categoriaId, soloBajoMinimo, fechaInicio, fechaFin, localDestinoId]);

  const handleSwitchReport = (val) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("reporte", val === "r2" ? "mermas" : "stock");
    setSearchParams(nextParams);
  };

  const isR1 = activeReport === "r1";
  const r1Items = reportData?.items || [];
  const r1Resumen = reportData?.resumen;
  const r2Bultos = reportData?.bultos_rechazados || [];
  const r2Resumen = reportData?.resumen;

  return (
    <div className="stocky-formal-preview-wrap stack gap-4 p-4">
      {/* Controles de vista previa en pantalla (ocultos en impresion) */}
      <div className="row justify-between align-center wrap gap-3 no-print p-3 bg-muted border border-subtle rounded">
        <div className="row align-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isR1 ? "/reportes/stock" : "/reportes/mermas")}
          >
            Volver al dashboard
          </Button>

          <SegmentedControl
            value={activeReport}
            onChange={handleSwitchReport}
            options={[
              { value: "r1", label: "Salud de stock" },
              { value: "r2", label: "Mermas y precintos" },
            ]}
          />
        </div>

        <div className="row align-center gap-2">
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            Imprimir o guardar PDF
          </Button>
        </div>
      </div>

      {/* Documento formal de auditoria */}
      <article className="stocky-formal-document">
        {/* Seccion 1: Portada y Resumen Ejecutivo en formato Vertical (Portrait) */}
        <section className="stocky-print-portrait">
          <header className="stocky-formal-header">
            <img
              src="/brand/stocky-logo.png"
              alt="Stocky Logo"
              className="stocky-formal-logo"
            />
            <div>
              <div className="stocky-formal-company">Stocky Distribución y Logística S.A.</div>
              <div className="stocky-formal-fiscal">
                CUIT: 30-71829401-8 · IVA Responsable Inscripto<br />
                Centro de Distribución Troncal: Av. Circunvalación 4500
              </div>
            </div>
            <div className="stocky-formal-meta-box">
              <div>Dictamen oficial de auditoría</div>
              <div className="dictamen-code">
                {isR1 ? "AUD-STK-2026-R1" : "AUD-MRM-2026-R2"}
              </div>
              <div>Fecha de emisión: {emittedDate}</div>
              <div>Auditor responsable: Martín Gómez</div>
            </div>
          </header>

          <div className="stocky-formal-question-banner">
            <div className="stocky-formal-question-title">
              {isR1
                ? "¿Dónde está el stock y cuál es su valorización?"
                : "¿Dónde se originaron las mermas y violaciones de precintos?"}
            </div>
            <div className="stocky-formal-question-sub">
              {isR1
                ? "Informe de auditoría sobre salud de existencias y valorización integral multisede."
                : "Informe de peritaje forense sobre bultos siniestrados, rechazos y rotura de precintos (Regla V1)."}
            </div>
          </div>

          <div className="stocky-formal-filters-box">
            <span className="font-medium">Snapshot inmutable de filtros aplicados: </span>
            <span>{filterSummary}</span>
          </div>

          {loading ? (
            <div className="stack gap-2 my-4">
              <Skeleton height={28} />
              <Skeleton height={60} />
            </div>
          ) : isR1 ? (
            <>
              <div className="stocky-formal-kpi-grid">
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Valorización a costo</div>
                  <div className="stocky-formal-kpi-value">{money(r1Resumen?.total_valorizado_costo)}</div>
                </div>
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Valorización a venta</div>
                  <div className="stocky-formal-kpi-value">{money(r1Resumen?.total_valorizado_venta)}</div>
                </div>
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Existencias en red</div>
                  <div className="stocky-formal-kpi-value">
                    {(r1Resumen?.total_existencias || 0).toLocaleString("es-AR")} un.
                  </div>
                </div>
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Artículos bajo mínimo</div>
                  <div className="stocky-formal-kpi-value">
                    {(r1Resumen?.total_items_criticos || 0).toLocaleString("es-AR")}
                  </div>
                </div>
              </div>

              <div className="stocky-formal-dictamen-panel">
                <div className="stocky-formal-dictamen-title">Dictamen del auditor de inventarios</div>
                <div className="stocky-formal-dictamen-body">
                  {(r1Resumen?.total_items_criticos || 0) > 0
                    ? `Se identificaron ${r1Resumen?.total_items_criticos} registros en o por debajo del stock de seguridad mínimo establecido. Se instruye a la coordinación logística emitir órdenes de reposición inmediatas desde el Centro de Distribución Central para restablecer los niveles de cobertura operativa.`
                    : "Los niveles de existencias físicas se encuentran balanceados conforme a las bandas de stock mínimo y reposición en todos los nodos evaluados. No se evidencian riesgos inminentes de rotura de inventario en el período auditado."}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="stocky-formal-kpi-grid">
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Bultos rechazados</div>
                  <div className="stocky-formal-kpi-value">
                    {(r2Resumen?.total_bultos_rechazados || 0).toLocaleString("es-AR")}
                  </div>
                </div>
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Pérdida a costo</div>
                  <div className="stocky-formal-kpi-value">{money(r2Resumen?.total_costo_merma)}</div>
                </div>
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Lucro cesante (venta)</div>
                  <div className="stocky-formal-kpi-value">{money(r2Resumen?.total_valor_venta_merma)}</div>
                </div>
                <div className="stocky-formal-kpi-card">
                  <div className="stocky-formal-kpi-label">Tasa de rechazo</div>
                  <div className="stocky-formal-kpi-value">{r2Resumen?.tasa_rechazo_porcentaje || 0}%</div>
                </div>
              </div>

              <div className="stocky-formal-dictamen-panel">
                <div className="stocky-formal-dictamen-title">Dictamen pericial forense</div>
                <div className="stocky-formal-dictamen-body">
                  {(r2Resumen?.total_bultos_rechazados || 0) > 0
                    ? `Se certifica la aplicación estricta de la Regla V1 sobre ${r2Resumen?.total_bultos_rechazados} bulto(s) recibido(s) con anomalías o precintos violados. La mercadería damnificada fue excluida del stock comercializable y registrada como merma definitiva. Sucursal con mayor incidencia: ${r2Resumen?.local_mas_afectado || "Sin definir"}. Se recomienda auditar la cadena de custodia de la empresa de transporte.`
                    : "No se registraron incidentes de rotura de precinto ni mermas en los despachos analizados durante el intervalo temporal auditado. La cadena de custodia se mantuvo intacta."}
                </div>
              </div>
            </>
          )}

          {(!reportData || (isR1 ? r1Items.length === 0 : r2Bultos.length === 0)) && !loading && (
            <div className="p-4 bg-muted border border-subtle rounded my-3 text-secondary text-sm">
              <span className="font-medium">Certificación formal: </span>
              No se hallaron registros ni incidentes en la base de datos para los criterios y filtros seleccionados.
            </div>
          )}
        </section>

        {/* Seccion 2: Apendice de Detalle en orientacion Apaisada (Landscape) */}
        {((isR1 && r1Items.length > 0) || (!isR1 && r2Bultos.length > 0)) && (
          <section className="stocky-print-appendix-landscape mt-4">
            <div className="stocky-formal-appendix-intro">
              <div className="stocky-formal-question-title">
                {isR1 ? "Apéndice documental: Existencias detalladas por nodo" : "Apéndice documental: Bitácora forense de incidentes"}
              </div>
              <div className="stocky-formal-question-sub">
                Orientación apaisada de alta fidelidad para salvaguardar la integridad de las columnas auditadas.
              </div>
            </div>

            {isR1 ? (
              <table className="stocky-formal-table">
                <thead>
                  <tr>
                    <th>Código SKU</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Ubicación</th>
                    <th>Tipo</th>
                    <th className="text-right">Disponible</th>
                    <th className="text-right">Tránsito</th>
                    <th className="text-right">Mínimo</th>
                    <th>Estado</th>
                    <th className="text-right">Val. Costo</th>
                    <th className="text-right">Val. Venta</th>
                  </tr>
                </thead>
                <tbody>
                  {r1Items.map((item, index) => (
                    <tr key={`${item.producto_id}-${item.ubicacion_id}-${index}`}>
                      <td className="font-mono">{item.producto_codigo}</td>
                      <td className="font-medium">{item.producto_nombre}</td>
                      <td>{item.categoria_nombre}</td>
                      <td>{item.ubicacion_nombre}</td>
                      <td>{item.ubicacion_tipo}</td>
                      <td className="text-right font-mono tabular-nums">{item.cantidad_disponible}</td>
                      <td className="text-right font-mono tabular-nums">{item.cantidad_en_transito}</td>
                      <td className="text-right font-mono tabular-nums">{item.nivel_minimo_existencia}</td>
                      <td>{item.estado_stock}</td>
                      <td className="text-right font-mono tabular-nums">{money(item.valorizacion_costo)}</td>
                      <td className="text-right font-mono tabular-nums">{money(item.valorizacion_venta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="stocky-formal-table">
                <thead>
                  <tr>
                    <th>Bulto ID</th>
                    <th>Remito</th>
                    <th>Precinto</th>
                    <th>Estado Precinto</th>
                    <th>Origen CD</th>
                    <th>Destino Local</th>
                    <th>Fecha Rechazo</th>
                    <th className="text-right">Cant. Damnificada</th>
                    <th className="text-right">Pérdida Costo</th>
                    <th className="text-right">Pérdida Venta</th>
                  </tr>
                </thead>
                <tbody>
                  {r2Bultos.map((bulto) => (
                    <tr key={bulto.bulto_id}>
                      <td className="font-mono font-medium">#{bulto.bulto_id}</td>
                      <td className="font-mono">{bulto.remito_numero || "N/A"}</td>
                      <td className="font-mono">{bulto.codigo_precinto || "SIN_PRECINTO"}</td>
                      <td>{bulto.precinto_intacto ? "Intacto" : "Violado (Regla V1)"}</td>
                      <td>{bulto.origen_nombre}</td>
                      <td className="font-medium">{bulto.destino_nombre}</td>
                      <td className="tabular-nums">
                        {bulto.fecha_rechazo ? new Date(bulto.fecha_rechazo).toLocaleString("es-AR") : "N/A"}
                      </td>
                      <td className="text-right font-mono tabular-nums">-{bulto.total_unidades} un.</td>
                      <td className="text-right font-mono tabular-nums">{money(bulto.total_perdida_costo)}</td>
                      <td className="text-right font-mono tabular-nums">{money(bulto.total_perdida_venta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <footer className="stocky-formal-footer">
              <span>Stocky ERP · Sistema de Ventas e Inventario</span>
              <span>Constancia de auditoría interna · Página formal</span>
            </footer>
          </section>
        )}
      </article>
    </div>
  );
}

export default ReporteImprimiblePage;
