import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../shared/feedback/ToastContext";
import { LiveIndicator } from "../../shared/hooks/useLiveResource.jsx";
import { KpiTrendChip } from "../../shared/components/DomainWidgets";
import { NotificationPanel } from "../../shared/components/NotificationPanel";
import { useAdminDashboard } from "./useAdminDashboard";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drawerPackage, setDrawerPackage] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
    notifications,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas,
  } = useAdminDashboard();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setDrawerPackage(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleExecuteAlerta = (alerta) => {
    if (alerta.accionTipo === "drawer_package") {
      setDrawerPackage(true);
    } else if (alerta.accionRuta) {
      navigate(alerta.accionRuta);
    } else {
      toast(`Acción iniciada para ${alerta.titulo}`);
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return (
    <main>
      <div className="context-strip">
        <span>
          <span className="micro">Alcance actual</span>
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
        <button
          type="button"
          className="button small context-strip__action"
          onClick={() => toast("Mostrando configuración de alcance de red")}
        >
          Cambiar alcance
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Notificaciones operativas (${unreadNotificationsCount} sin leer)`}
          title="Notificaciones operativas"
          onClick={() => setShowNotifications((prev) => !prev)}
        >
          &#128276;
          {unreadNotificationsCount > 0 && <span className="notification-dot" />}
        </button>
      </div>

      {showNotifications && (
        <NotificationPanel
          open={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onMarkRead={marcarNotificacionLeida}
          onMarkAllRead={marcarTodasNotificacionesLeidas}
          onResolve={(notif) => {
            setShowNotifications(false);
            if (notif.actionRuta) navigate(notif.actionRuta);
            else toast(`Resolviendo: ${notif.title}`);
          }}
        />
      )}

      <div className="page-head">
        <div>
          <h1>Panel de control</h1>
          <p className="muted">
            Alertas con resolución directa, trabajo pendiente y últimos movimientos.
          </p>
        </div>
        <LiveIndicator
          freshnessSeconds={freshnessSeconds}
          isStale={isStale}
          onRefresh={refresh}
        />
      </div>

      {error && (
        <div className="validation-note mb-4 text-danger">
          No se pudieron sincronizar todos los datos en vivo. Mostrando últimos datos disponibles.
          <button type="button" className="button ghost small ml-2" onClick={refresh}>
            Reintentar
          </button>
        </div>
      )}

      <div className="grid kpis">
        {metricasTendencia.map((kpi) => (
          <article
            key={kpi.id}
            className="card metric interactive cursor-pointer"
            onClick={() => kpi.deepLink && navigate(kpi.deepLink)}
            title={`Abrir filtro para ${kpi.label}`}
          >
            <span className="micro">{kpi.label}</span>
            <strong className="tabular">{loading ? "..." : kpi.valor}</strong>
            {kpi.badgeText && (
              <span className={`badge ${kpi.badgeTone || "info"}`}>
                {kpi.badgeText}
              </span>
            )}
            {kpi.subtext && <span className="trend muted">{kpi.subtext}</span>}
            {kpi.trend && (
              <KpiTrendChip
                direction={kpi.trend.direction}
                difference={kpi.trend.difference}
                period={kpi.trend.period}
                meaning={kpi.trend.meaning}
              />
            )}
          </article>
        ))}
      </div>

      <div className="grid two dashboard-grid-two">
        <article className="card">
          <div className="row justify-between align-center">
            <h2>Alertas accionables</h2>
            <button
              type="button"
              className="button ghost small"
              onClick={() => navigate("/stock/alertas?estado=pendientes")}
            >
              Ver todas
            </button>
          </div>
          <ul className="list">
            {alertasAccionables.slice(0, 5).map((alerta) => (
              <li key={alerta.id}>
                <span>
                  <strong>{alerta.titulo}</strong>
                  <br />
                  <span className="micro">{alerta.descripcion}</span>
                </span>
                <span className="list-actions">
                  <span
                    className={`badge ${
                      alerta.severidad === "critica"
                        ? "bad"
                        : alerta.severidad === "alta"
                        ? "warn"
                        : "info"
                    }`}
                  >
                    {alerta.categoria}
                  </span>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => handleExecuteAlerta(alerta)}
                  >
                    {alerta.accionLabel}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Trabajo pendiente</h2>
          <ul className="list">
            <li>
              <span>Órdenes por preparar</span>
              <strong className="tabular">
                {trabajoPendiente.ordenesPorPreparar}
              </strong>
            </li>
            <li>
              <span>Remitos por despachar</span>
              <strong className="tabular">
                {trabajoPendiente.remitosPorDespachar}
              </strong>
            </li>
            <li>
              <span>Bultos por verificar</span>
              <strong className="tabular">
                {trabajoPendiente.bultosPorVerificar}
              </strong>
            </li>
          </ul>
          <button
            type="button"
            className="button primary"
            onClick={() => navigate("/logistica/empaquetado")}
          >
            Abrir operación activa
          </button>
        </article>
      </div>

      <article className="card dashboard-movements-card">
        <div className="row justify-between align-center">
          <h2>Últimos movimientos</h2>
          <button
            type="button"
            className="button ghost small"
            onClick={() => navigate("/logistica/trazabilidad")}
          >
            Abrir trazabilidad
          </button>
        </div>
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
            {ultimosMovimientos.map((mov) => (
              <tr key={mov.id}>
                <td className="tabular">{mov.hora}</td>
                <td>
                  <span className="font-mono text-xs">{mov.entidad}</span>
                </td>
                <td>{mov.accion}</td>
                <td>
                  <span className="row row-start align-center gap-1">
                    <span className="avatar sm light">{mov.responsableInitials}</span>
                    <span>{mov.responsableNombre}</span>
                  </span>
                </td>
                <td>{mov.sede}</td>
                <td>{mov.consecuencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      {drawerPackage && (
        <div
          className="overlay"
          aria-modal="true"
          role="dialog"
          aria-labelledby="drawerTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerPackage(false);
          }}
        >
          <aside className="drawer">
            <div className="drawer-head">
              <div>
                <h2 id="drawerTitle">Crear o completar bulto</h2>
                <p className="muted" id="drawerSubtitle">
                  Orden OR-000118 · CD Central &rarr; Local Palermo
                </p>
              </div>
              <button
                type="button"
                className="icon-button overlay-close"
                aria-label="Cerrar"
                onClick={() => setDrawerPackage(false)}
              >
                &times;
              </button>
            </div>
            <div className="drawer-body">
              <div className="stepper">
                <div className="step done">Orden</div>
                <div className="step current">Contenido</div>
                <div className="step">Precinto</div>
                <div className="step">Revisar</div>
              </div>
              <div className="context-strip">
                <span>
                  <span className="micro">Orden</span>
                  <br />
                  <strong>OR-000118</strong>
                </span>
                <span className="separator" />
                <span>
                  <span className="micro">Ruta</span>
                  <br />
                  <strong>CD Central &rarr; Local Palermo</strong>
                </span>
              </div>
              <div className="field">
                <label>Buscar producto pendiente</label>
                <div className="search-wrap">
                  <input
                    className="search-input"
                    placeholder="SKU o nombre"
                    defaultValue="Café"
                  />
                </div>
                <div className="search-select-results">
                  <button type="button" className="option">
                    <span>
                      <strong>SKU-229 · Café 500 g</strong>
                      <br />
                      <span className="micro">Pendiente 6 · disponible 46</span>
                    </span>
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
              <div className="field-grid drawer-field-grid">
                <div className="field">
                  <label>Cantidad</label>
                  <input className="input" inputMode="numeric" defaultValue="6" />
                  <span className="field-help">Entero entre 1 y 6.</span>
                </div>
                <div className="field">
                  <label>Precinto</label>
                  <input className="input" defaultValue="PC-883103" maxLength={32} />
                  <span className="field-help">
                    Único, no reutilizable; permite letras, números y guion.
                  </span>
                </div>
              </div>
              <div className="validation-note drawer-validation-note">
                Crear el bulto reserva 6 unidades en CD Central. Precintarlo no despacha:
                el despacho ocurre con el remito completo.
              </div>
            </div>
            <div className="drawer-foot">
              <button
                type="button"
                className="button overlay-close"
                onClick={() => setDrawerPackage(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setDrawerPackage(false);
                  toast("Bulto creado y trazabilidad actualizada.");
                }}
              >
                Crear bulto
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

export default AdminDashboardPage;
