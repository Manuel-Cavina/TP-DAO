import React from "react";
import { useNavigate } from "react-router-dom";
import { LiveIndicator } from "../../shared/hooks/useLiveResource.jsx";
import { Alert, Badge, Button } from "../../shared";
import { useAdminDashboard } from "./useAdminDashboard";

const ALERT_TONE = {
  critica: "bad",
  alta: "warn",
  media: "info",
};

function DashboardLoading() {
  return (
    <>
      <div className="grid two dashboard-grid-two" aria-hidden="true">
        <article className="card dashboard-skeleton-card" />
        <article className="card dashboard-skeleton-card" />
      </div>
      <div className="grid kpis dashboard-cycle" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <article key={item} className="card dashboard-skeleton-metric" />
        ))}
      </div>
    </>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const {
    loading,
    error,
    refresh,
    freshnessSeconds,
    isStale,
    redInfo,
    alertasAccionables,
    trabajoPendiente,
    metricasTendencia,
    ultimosMovimientos,
  } = useAdminDashboard();

  const hasPendingWork = Object.values(trabajoPendiente).some((count) => count > 0);

  return (
    <main className="dashboard-home">
      <div className="page-head">
        <div>
          <h1>Panel de control</h1>
          <p className="muted">Alertas con resolución directa, trabajo pendiente y últimos movimientos.</p>
        </div>
        <LiveIndicator
          freshnessSeconds={freshnessSeconds}
          isStale={isStale}
          onRefresh={refresh}
        />
      </div>

      <div className="context-strip dashboard-scope">
        <span>
          <span className="micro">Alcance</span>
          <br />
          <strong>Red completa</strong>
        </span>
        <span className="separator" />
        <span>
          <span className="micro">Centros activos</span>
          <br />
          <strong>{redInfo.centrosLabel}</strong>
        </span>
        <span className="separator" />
        <span>
          <span className="micro">Locales activos</span>
          <br />
          <strong>{redInfo.localesLabel}</strong>
        </span>
      </div>

      {error && <Alert tone="danger" title="No se pudo actualizar el panel" description="Reintentá la consulta para recuperar los datos operativos." action={<Button variant="secondary" size="sm" onClick={refresh}>Reintentar</Button>} />}

      {loading ? (
        <DashboardLoading />
      ) : (
        <>
          <div className="grid kpis dashboard-cycle" aria-label="Carga del ciclo">
            {metricasTendencia.map((metric) => (
              <button
                key={metric.id}
                type="button"
                className="card metric dashboard-cycle-metric"
                onClick={() => navigate(metric.deepLink)}
              >
                <span className="micro">{metric.label}</span>
                <strong className="tabular">{metric.valor}</strong>
                <span className="micro">Abrir lista</span>
              </button>
            ))}
          </div>

          <div className="grid two dashboard-grid-two dashboard-operational-grid">
            <article className="card dashboard-alert-card">
              <div className="row">
                <div>
                  <h2>Alertas accionables</h2>
                  <p className="micro">Priorizadas por impacto operativo.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/stock/alertas?estado=pendientes")}>Ver alertas</Button>
              </div>

              {alertasAccionables.length === 0 ? (
                <div className="dashboard-empty">
                  <strong>Sin alertas accionables</strong>
                  <span className="micro">El stock y los traslados no requieren atención inmediata.</span>
                </div>
              ) : (
                <ul className="list">
                  {alertasAccionables.slice(0, 4).map((alerta) => (
                    <li key={alerta.id}>
                      <span>
                        <strong>{alerta.titulo}</strong>
                        <br />
                        <span className="micro">{alerta.descripcion}</span>
                      </span>
                      <span className="list-actions">
                        <Badge tone={ALERT_TONE[alerta.severidad] === "bad" ? "danger" : ALERT_TONE[alerta.severidad] === "warn" ? "warning" : "info"}>{alerta.categoria}</Badge>
                        {alerta.accionRuta && (
                          <Button size="sm" onClick={() => navigate(alerta.accionRuta)}>{alerta.accionLabel}</Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="card">
              <div className="row">
                <div>
                  <h2>Trabajo pendiente</h2>
                  <p className="micro">Cada conteo abre la cola correspondiente.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/logistica/operaciones")}>Abrir cola</Button>
              </div>

              {hasPendingWork ? (
                <ul className="list dashboard-work-list">
                  <li>
                    <button type="button" onClick={() => navigate("/logistica/ordenes")}>
                      <span>Órdenes por preparar</span>
                      <strong className="tabular">{trabajoPendiente.ordenesPorPreparar}</strong>
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => navigate("/logistica/remitos")}>
                      <span>Remitos por despachar</span>
                      <strong className="tabular">{trabajoPendiente.remitosPorDespachar}</strong>
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => navigate("/logistica/recepcion")}>
                      <span>Bultos por verificar</span>
                      <strong className="tabular">{trabajoPendiente.bultosPorVerificar}</strong>
                    </button>
                  </li>
                </ul>
              ) : (
                <div className="dashboard-empty">
                  <strong>Sin trabajo pendiente</strong>
                  <span className="micro">No hay preparación, despacho ni recepción esperando una acción.</span>
                </div>
              )}
            </article>
          </div>

          <article className="card dashboard-movements-card">
            <div className="row">
              <div>
                <h2>Últimos movimientos</h2>
                <p className="micro">Evidencia reciente de operaciones registradas.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/logistica/trazabilidad")}>Ver trazabilidad</Button>
            </div>

            {ultimosMovimientos.length === 0 ? (
              <div className="dashboard-empty">
                <strong>Aún no hay movimientos para mostrar</strong>
                <span className="micro">La trazabilidad se actualizará cuando el backend exponga eventos recientes.</span>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Entidad</th>
                    <th>Acción</th>
                    <th>Responsable</th>
                    <th>Sede</th>
                    <th>Consecuencia</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosMovimientos.map((movement) => (
                    <tr key={movement.id}>
                      <td className="tabular">{movement.hora}</td>
                      <td>{movement.entidad}</td>
                      <td>{movement.accion}</td>
                      <td>{movement.responsableNombre}</td>
                      <td>{movement.sede}</td>
                      <td>{movement.consecuencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </>
      )}
    </main>
  );
}

export default AdminDashboardPage;
