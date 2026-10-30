import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { reportesService } from "../services/reportesService";
import { Button } from "../../../shared/components/Button";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Skeleton, Alert } from "../../../shared/components/Feedback";
import { useAuth } from "../../../app/auth/AuthProvider";
import { actorLabel, readReportSnapshot, sealLabel } from "../services/reportSnapshot.js";
import "../reportes.css";
import "../reportes-details.css";

const money = (val) => val == null ? "No disponible" : `$${Number(val).toLocaleString("es-AR")}`;

export function ReporteImprimiblePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const snapshotId = searchParams.get("snapshot");

  const reportParam = searchParams.get("reporte") || "stock";
  const activeReport = reportParam === "mermas" || reportParam === "r2" ? "r2" : "r1";

  const [ubicaciones, setUbicaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(null);
  const emittedDate = loadedAt ? new Date(loadedAt).toLocaleString("es-AR") : "Pendiente";

  const ubicacionId = searchParams.get("ubicacion_id") || "";
  const categoriaId = searchParams.get("categoria_id") || "";
  const soloBajoMinimo = searchParams.get("solo_bajo_minimo") === "true";
  const fechaInicio = searchParams.get("fecha_inicio") || "";
  const fechaFin = searchParams.get("fecha_fin") || "";
  const localDestinoId = searchParams.get("local_destino_id") || "";
  const autoPrint = searchParams.get("autoPrint") === "1" || searchParams.get("autoPrint") === "true";

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setReportData(null); setSnapshot(null);
    async function load() {
      try {
        if (snapshotId) {
          const saved = readReportSnapshot(window.sessionStorage, snapshotId, user?.id);
          if (saved.reportKey !== activeReport) throw new Error("La captura no corresponde al reporte seleccionado.");
          if (active) { setSnapshot(saved); setReportData(saved.data); setLoadedAt(saved.generatedAt); }
        } else {
          const params = activeReport === "r1"
            ? { ubicacion_id: ubicacionId ? Number(ubicacionId) : undefined, categoria_id: categoriaId ? Number(categoriaId) : undefined, solo_bajo_minimo: soloBajoMinimo }
            : { fecha_inicio: fechaInicio, fecha_fin: fechaFin, local_destino_id: localDestinoId ? Number(localDestinoId) : undefined };
          const [data, locations, categories] = await Promise.all([
            activeReport === "r1" ? reportesService.getR1StockValorizacion(params) : reportesService.getR2MermasPrecinto(params),
            reportesService.getUbicaciones(), reportesService.getCategorias(),
          ]);
          if (active) { setReportData(data); setUbicaciones(locations); setCategorias(categories); setLoadedAt(new Date().toISOString()); }
        }
      } catch (failure) { if (active) setError(failure); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [snapshotId, user?.id, activeReport, ubicacionId, categoriaId, soloBajoMinimo, fechaInicio, fechaFin, localDestinoId, attempt]);

  // Autoprint si fue solicitado por la barra de exportación
  useEffect(() => {
    if (!loading && !error && reportData && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading, error, reportData, autoPrint]);

  const filterSummary = useMemo(() => {
    if (snapshot) return snapshot.filterDescription;
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
  }, [snapshot, activeReport, ubicaciones, categorias, ubicacionId, categoriaId, soloBajoMinimo, fechaInicio, fechaFin, localDestinoId]);

  const handleSwitchReport = (val) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("snapshot");
    nextParams.delete("autoPrint");
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
          <Button variant="primary" size="sm" disabled={loading || Boolean(error) || !reportData} onClick={() => window.print()}>
            Imprimir o guardar PDF
          </Button>
        </div>
      </div>

      {error && <Alert tone="danger" title="No se pudo preparar el reporte" description={error.message} action={<Button onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button>} />}
      {/* Documento formal de auditoria */}
      {!error && <article className="stocky-formal-document">
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
              <div>Responsable: {snapshot?.actor.label || actorLabel(user)}</div>
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
            <span className="font-medium">Captura de los datos consultados (no certificada por servidor): </span>
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
                  <div className="stocky-formal-kpi-value">{r2Resumen?.tasa_rechazo_porcentaje == null ? "No disponible" : `${r2Resumen.tasa_rechazo_porcentaje}%`}</div>
                </div>
              </div>

              <div className="stocky-formal-dictamen-panel">
                <div className="stocky-formal-dictamen-title">Dictamen pericial forense</div>
                <div className="stocky-formal-dictamen-body">
                  {(r2Resumen?.total_bultos_rechazados || 0) > 0
                    ? `Se registraron ${r2Resumen?.total_bultos_rechazados} bulto(s) con merma. Este informe conserva únicamente los valores y relaciones que entrega el endpoint; no infiere ranking de sucursales, tasa de rechazo ni valor de venta.`
                    : "No se registraron incidentes de rotura de precinto ni mermas en los despachos analizados durante el intervalo temporal auditado. La ausencia de mermas no certifica todos los despachos."}
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
                      <td className="font-mono">{bulto.codigo_precinto ?? "No informado"}</td>
                      <td>{sealLabel(bulto.precinto_intacto)}</td>
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
      </article>}
    </div>
  );
}

export default ReporteImprimiblePage;
