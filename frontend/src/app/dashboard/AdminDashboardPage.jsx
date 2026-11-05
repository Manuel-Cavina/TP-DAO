import React from "react";
import { Link } from "react-router-dom";
import { RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "../../components/arc/button/button";
import { Badge } from "../../components/arc/badge/badge";
import { Alert } from "../../components/arc/alert/alert";
import { Skeleton } from "../../components/arc/skeleton/skeleton";
import { useAdminDashboard } from "./useAdminDashboard";
import "./dashboard.css";
const figure = (value) => value === null ? "No disponible" : value.toLocaleString("es-AR");
export function AdminDashboardPage() {
  const { loading, error, errors, refresh, freshnessSeconds, isStale, metrics, tasks, redInfo, alertasAccionables, ultimosMovimientos } = useAdminDashboard();
  return <div className="dashboard-workbench">
    <header className="dashboard-heading">
      <div><h1>Panel operativo</h1><p>Trabajo pendiente en la red. Elegí una tarea para continuar.</p></div>
      <div className="dashboard-refresh"><span>{freshnessSeconds === null ? "Sin sincronización completa" : `${isStale ? "Datos anteriores" : "Actualizado"} hace ${freshnessSeconds}s`}</span><Button variant="secondary" size="sm" disabled={loading} onClick={refresh}><RotateCcw size={16} aria-hidden="true" />Actualizar datos</Button></div>
    </header>
    <div className="dashboard-scope"><span>Alcance: red completa</span><span>{figure(redInfo.centrosActivos)} centros activos</span><span>{figure(redInfo.localesActivos)} locales activos</span></div>
    {error && <Alert tone="warning" title="Hay fuentes sin actualizar">Las secciones afectadas indican si muestran datos anteriores o no disponibles. <Button variant="ghost" size="sm" onClick={refresh}>Reintentar consulta</Button></Alert>}
    <section aria-labelledby="pending-work" aria-busy={loading}>
      <div className="dashboard-section-heading"><h2 id="pending-work">Continuar la operación</h2><Link to="/logistica/operaciones">Abrir distribución <ArrowRight size={14} aria-hidden="true" /></Link></div>
      <div className="dashboard-task-list">{tasks.map((task) => <div className="dashboard-task" key={task.id}>
        <div className="dashboard-task-count">{loading && task.count === null ? <Skeleton lines={1} label="Consultando tareas" /> : figure(task.count)}</div>
        <div><h3>{task.label}</h3><p>{task.description}</p>{task.stale && <span className="dashboard-stale">{task.count === null ? "Fuente no disponible" : "Último dato disponible"}</span>}</div>
        <Link to={task.route}>{task.action}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>)}</div>
    </section>
    <div className="dashboard-secondary-grid">
      <section className="dashboard-region" aria-labelledby="replenishment-heading">
        <div className="dashboard-section-heading"><h2 id="replenishment-heading">Reposición prioritaria</h2><Link to="/stock/alertas">Ver alertas</Link></div>
        {loading && !alertasAccionables.length ? <Skeleton lines={3} label="Consultando reposición" /> : errors.alertas && !alertasAccionables.length ? <p>No se pudieron consultar las alertas. Reintentá la consulta.</p> : !alertasAccionables.length ? <p>No hay alertas sin leer. El inventario permite revisar las existencias actuales.</p> : <ul className="dashboard-alerts">{alertasAccionables.slice(0, 4).map((alerta) => <li key={alerta.id}><div><Link to={alerta.accionRuta}>{alerta.titulo}</Link><p>{alerta.descripcion}</p></div><Badge tone={alerta.severidad === "critica" ? "danger" : "warning"}>{alerta.severidad === "critica" ? "Sin stock" : "Bajo mínimo"}</Badge></li>)}</ul>}
      </section>
      <section className="dashboard-region" aria-labelledby="sales-heading">
        <div className="dashboard-section-heading"><h2 id="sales-heading">Ventas registradas</h2><Link to="/ventas?tab=facturas">Ver comprobantes</Link></div>
        <p>Últimos 30 días. Todas las ubicaciones consultadas.</p>
        <div className="dashboard-sales-value">{metrics.salesTotal === null ? "No disponible" : metrics.salesTotal.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })}</div>
        <p>{figure(metrics.salesCount)} comprobantes. Importe bruto de ventas, sin descontar devoluciones.</p>
        {errors.ventas && <p className="dashboard-stale">{metrics.salesTotal === null ? "No se pudieron consultar las ventas." : "Se conserva el último dato disponible."}</p>}
      </section>
    </div>
    <section className="dashboard-region" aria-labelledby="activity-heading">
      <div className="dashboard-section-heading"><div><h2 id="activity-heading">Últimos movimientos</h2><p>Evidencia informada por los servicios de trazabilidad.</p></div><Link to="/logistica/trazabilidad">Ver trazabilidad</Link></div>
      {loading && !ultimosMovimientos.length ? <Skeleton lines={3} label="Consultando movimientos" /> : !ultimosMovimientos.length ? <p>{errors.movimientos ? "No se pudieron consultar los movimientos." : "No hay movimientos recientes informados."}</p> : <div className="erp-table-scroll"><table className="dashboard-movements"><thead><tr><th>Fecha</th><th>Entidad y acción</th><th>Responsable y ubicación</th><th>Evidencia</th></tr></thead><tbody>{ultimosMovimientos.slice(0, 5).map((row) => <tr key={row.id}><td className="tabular-nums">{row.hora}</td><td>{row.entidad}<span>{row.accion}</span></td><td>{row.responsableNombre}<span>{row.sede}</span></td><td>{row.consecuencia}</td></tr>)}</tbody></table></div>}
      {errors.movimientos && ultimosMovimientos.length > 0 && <p className="dashboard-stale">Movimientos de la última consulta disponible.</p>}
    </section>
  </div>;
}
export default AdminDashboardPage;
