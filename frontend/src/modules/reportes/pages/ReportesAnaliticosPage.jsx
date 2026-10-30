import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../reportes.css";
import { Alert, Badge, Button, EmptyState, MetricCard, SegmentedControl, Skeleton } from "../../../shared";
import { PlotlyRenderer } from "../components/PlotlyRenderer";
import { reportesAnaliticosService as service } from "../services/reportesAnaliticosService";

const toIsoDate = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const hoy = () => toIsoDate(new Date());
const haceUnAnio = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toIsoDate(d);
};

const pesos = (v) =>
  Number(v || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const numero = (v, dec = 0) =>
  Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const MEDIOS = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia" };
const medio = (m) => MEDIOS[String(m).toUpperCase()] || m;

const REPORTES = {
  ventas: {
    path: "/reportes/ventas",
    titulo: "Ventas e ingresos por período, local y medio de pago",
    pregunta: "¿Cuánto vendió cada local y con qué medio de pago, neto de devoluciones?",
    cargar: (f) => service.ventas(f),
    metricas: (t) => [
      { label: "Ventas", value: numero(t.cantidad_ventas) },
      { label: "Total bruto", value: pesos(t.total_bruto) },
      { label: "Devoluciones", value: pesos(t.total_devoluciones), tone: "danger" },
      { label: "Total neto", value: pesos(t.total_neto), tone: "success" },
    ],
    columnas: [
      { key: "local_nombre", label: "Local" },
      { key: "medio_pago", label: "Medio de pago", render: (f) => medio(f.medio_pago) },
      { key: "cantidad_ventas", label: "Ventas", num: true, render: (f) => numero(f.cantidad_ventas) },
      { key: "total_bruto", label: "Bruto", num: true, render: (f) => pesos(f.total_bruto) },
      { key: "cantidad_devoluciones", label: "Devol.", num: true, render: (f) => numero(f.cantidad_devoluciones) },
      { key: "total_devoluciones", label: "Monto devuelto", num: true, render: (f) => pesos(f.total_devoluciones) },
      { key: "total_neto", label: "Neto", num: true, render: (f) => <strong>{pesos(f.total_neto)}</strong> },
    ],
    rowKey: (f) => `${f.local_id}-${f.medio_pago}`,
  },
  productos: {
    path: "/reportes/productos",
    titulo: "Productos más vendidos y margen estimado",
    pregunta: "¿Qué productos se venden más y cuáles dejan pérdida?",
    cargar: (f) => service.productosMasVendidos(f),
    metricas: (t) => [
      { label: "Unidades netas", value: numero(t.unidades_netas) },
      { label: "Ingresos", value: pesos(t.ingresos) },
      { label: "Margen total", value: pesos(t.margen), tone: Number(t.margen) < 0 ? "danger" : "success" },
      {
        label: "Productos con pérdida",
        value: numero(t.productos_con_perdida),
        tone: Number(t.productos_con_perdida) > 0 ? "danger" : "neutral",
      },
    ],
    columnas: [
      { key: "codigo", label: "Código", render: (f) => <span className="font-mono text-xs">{f.codigo}</span> },
      { key: "nombre", label: "Producto" },
      { key: "unidades_netas", label: "Unid. netas", num: true, render: (f) => numero(f.unidades_netas) },
      { key: "ingresos", label: "Ingresos", num: true, render: (f) => pesos(f.ingresos) },
      { key: "costo", label: "Costo", num: true, render: (f) => pesos(f.costo) },
      {
        key: "margen",
        label: "Margen $",
        num: true,
        render: (f) => <span className={f.margen_negativo ? "text-danger font-medium" : ""}>{pesos(f.margen)}</span>,
      },
      {
        key: "margen_porcentaje",
        label: "Margen %",
        num: true,
        render: (f) =>
          f.margen_negativo ? (
            <Badge tone="danger">{numero(f.margen_porcentaje, 1)} %</Badge>
          ) : (
            `${numero(f.margen_porcentaje, 1)} %`
          ),
      },
    ],
    rowKey: (f) => f.producto_id,
  },
  transito: {
    path: "/reportes/transito",
    titulo: "Tiempo de tránsito CD → locales",
    pregunta: "¿Cuántas horas tarda un bulto desde que sale del CD hasta que llega al local?",
    cargar: (f) => service.tiemposTransito(f),
    metricas: (t, filas) => {
      const bultos = Number(t.bultos_recibidos || 0);
      const promedio = bultos
        ? filas.reduce((acc, f) => acc + Number(f.promedio_horas) * f.cantidad_bultos, 0) / bultos
        : 0;
      return [
        { label: "Bultos recibidos", value: numero(bultos) },
        { label: "Promedio general", value: `${numero(promedio, 1)} h` },
        { label: "Locales", value: numero(filas.length) },
      ];
    },
    columnas: [
      { key: "local_nombre", label: "Local destino" },
      { key: "cantidad_bultos", label: "Bultos", num: true, render: (f) => numero(f.cantidad_bultos) },
      { key: "promedio_horas", label: "Promedio (h)", num: true, render: (f) => numero(f.promedio_horas, 1) },
      { key: "minimo_horas", label: "Mínimo (h)", num: true, render: (f) => numero(f.minimo_horas, 1) },
      { key: "maximo_horas", label: "Máximo (h)", num: true, render: (f) => numero(f.maximo_horas, 1) },
    ],
    rowKey: (f) => f.local_id,
  },
};

const reporteDesdeRuta = (pathname) =>
  Object.keys(REPORTES).find((k) => pathname.endsWith(REPORTES[k].path.split("/").pop())) || "ventas";

export function ReportesAnaliticosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activo = reporteDesdeRuta(location.pathname);
  const config = REPORTES[activo];

  const [desde, setDesde] = useState(haceUnAnio);
  const [hasta, setHasta] = useState(hoy);
  const [localId, setLocalId] = useState("");
  const [top, setTop] = useState(10);
  const [locales, setLocales] = useState([]);
  const [estado, setEstado] = useState({ reporte: null, loading: true, error: null, data: null });

  useEffect(() => {
    service.locales().then(setLocales).catch(() => setLocales([]));
  }, []);

  const rangoInvalido = Boolean(desde && hasta && desde > hasta);
  const ultimaConsulta = useRef(0);

  const cargar = useCallback(async () => {
    if (!desde || !hasta || rangoInvalido) return;
    const consulta = ++ultimaConsulta.current;
    setEstado({ reporte: activo, loading: true, error: null, data: null });
    try {
      const data = await config.cargar({ desde, hasta, localId: localId || undefined, top });
      if (consulta !== ultimaConsulta.current) return;
      setEstado({ reporte: activo, loading: false, error: null, data });
    } catch (error) {
      if (consulta !== ultimaConsulta.current) return;
      setEstado({ reporte: activo, loading: false, error, data: null });
    }
  }, [activo, config, desde, hasta, localId, top, rangoInvalido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Evita dibujar filas de un reporte con las columnas de otro mientras se cambia de pestaña.
  const vigente = estado.reporte === activo;
  const cargando = estado.loading || !vigente;
  const filas = useMemo(() => (vigente && estado.data ? estado.data.filas : []), [vigente, estado.data]);
  const metricas = useMemo(
    () => (vigente && estado.data ? config.metricas(estado.data.totales, filas) : []),
    [vigente, config, estado.data, filas]
  );

  return (
    <div className="stocky-reports-page">
      <div className="stocky-report-screen stack gap-4">
        <div className="card p-4">
          <h2 className="text-lg font-medium">{config.titulo}</h2>
          <p className="text-xs text-secondary">{config.pregunta}</p>
        </div>

        <div className="stocky-toolbar-card">
          <SegmentedControl
            ariaLabel="Reporte analítico"
            value={activo}
            onChange={(v) => navigate(REPORTES[v].path)}
            options={[
              { value: "ventas", label: "Ventas e ingresos" },
              { value: "productos", label: "Más vendidos y margen" },
              { value: "transito", label: "Tiempo de tránsito" },
            ]}
          />

          <div className="stocky-filter-row pt-2 border-t border-subtle mt-3">
            <div className="stocky-filter-controls">
              <div className="row align-center gap-1">
                <span className="text-xs text-muted">Desde:</span>
                <input
                  type="date"
                  aria-label="Fecha desde"
                  className="erp-input erp-input--sm"
                  value={desde}
                  max={hasta || undefined}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
              <div className="row align-center gap-1">
                <span className="text-xs text-muted">Hasta:</span>
                <input
                  type="date"
                  aria-label="Fecha hasta"
                  className="erp-input erp-input--sm"
                  value={hasta}
                  min={desde || undefined}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>

              {activo === "ventas" && (
                <select
                  className="erp-input erp-input--sm stocky-filter-select"
                  aria-label="Local"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                >
                  <option value="">Todos los locales</option>
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              )}

              {activo === "productos" && (
                <select
                  className="erp-input erp-input--sm stocky-filter-select"
                  aria-label="Cantidad de productos"
                  value={top}
                  onChange={(e) => setTop(Number(e.target.value))}
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      Top {n}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {rangoInvalido && (
          <Alert tone="warning" title="Rango de fechas inválido" description="La fecha desde no puede ser posterior a la fecha hasta." />
        )}

        {vigente && estado.error && (
          <Alert
            tone="danger"
            title="No se pudo cargar el reporte"
            description={estado.error.message}
            action={
              <Button variant="secondary" size="sm" onClick={cargar}>
                Reintentar
              </Button>
            }
          />
        )}

        {!(vigente && estado.error) && !rangoInvalido && (
          <>
            {cargando ? (
              <div className="stack gap-2">
                <Skeleton height={72} />
                <Skeleton height={240} />
              </div>
            ) : (
              <>
                <div className="stocky-kpi-grid">
                  {metricas.map((m) => (
                    <MetricCard
                      key={m.label}
                      label={m.label}
                      value={m.value}
                      badgeTone={m.tone || "neutral"}
                    />
                  ))}
                </div>

                {filas.length === 0 ? (
                  <EmptyState
                    icon="chart"
                    title="Sin datos en el período"
                    description="No hay operaciones registradas para los filtros elegidos. Probá ampliar el rango de fechas."
                  />
                ) : (
                  <>
                    {estado.data?.grafico && <PlotlyRenderer figure={estado.data.grafico} height={320} />}
                    <div className="card overflow-x-auto">
                      <table className="erp-table stocky-report-table">
                        <thead>
                          <tr>
                            {config.columnas.map((c) => (
                              <th key={c.key} className={c.num ? "align-right" : undefined}>
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((f) => (
                            <tr key={config.rowKey(f)}>
                              {config.columnas.map((c) => (
                                <td key={c.key} className={c.num ? "align-right tabular-nums" : undefined}>
                                  {c.render ? c.render(f) : f[c.key]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ReportesAnaliticosPage;
