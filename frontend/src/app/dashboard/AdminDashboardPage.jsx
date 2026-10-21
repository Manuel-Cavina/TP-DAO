import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../shared/feedback/ToastContext";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drawerPackage, setDrawerPackage] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setDrawerPackage(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
          <strong>CD Central · CD Norte</strong>
        </span>
        <span className="separator" />
        <span>
          <span className="micro">Locales activos</span>
          <br />
          <strong>Palermo · Centro · Norte · Sur</strong>
        </span>
        <button
          type="button"
          className="button small context-strip__action"
          onClick={() => toast("Abriendo configuración de alcance")}
        >
          Cambiar alcance
        </button>
      </div>

      <div className="page-head">
        <div>
          <h1>Panel de control</h1>
          <p className="muted">
            Alertas con resolución directa, trabajo pendiente y últimos movimientos.
          </p>
        </div>
        <span className="micro tabular">Actualizado hace 6 s</span>
      </div>

      <div className="grid kpis">
        <article className="card metric">
          <span className="micro">Tareas críticas</span>
          <strong className="tabular">7</strong>
          <span className="badge bad">2 vencidas</span>
          <span className="trend-chip down">&uarr; 2 desde ayer</span>
        </article>
        <article className="card metric">
          <span className="micro">En preparación</span>
          <strong className="tabular">12</strong>
          <span className="trend muted">4 requieren precinto</span>
          <span className="trend-chip up">&uarr; 12% esta semana</span>
        </article>
        <article className="card metric">
          <span className="micro">En tránsito</span>
          <strong className="tabular">5</strong>
          <span className="trend muted">84 unidades</span>
          <span className="trend-chip up">&darr; 8% vs. ayer</span>
        </article>
        <article className="card metric">
          <span className="micro">Por verificar</span>
          <strong className="tabular">8</strong>
          <span className="badge warn">1 incidencia</span>
          <span className="trend-chip down">&uarr; 3 en la última hora</span>
        </article>
      </div>

      <div className="grid two dashboard-grid-two">
        <article className="card">
          <div className="row">
            <h2>Alertas accionables</h2>
            <button
              type="button"
              className="button ghost small"
              onClick={() => toast("Mostrando todas las alertas")}
            >
              Ver todas
            </button>
          </div>
          <ul className="list">
            <li>
              <span>
                <strong>Remito RM-000078 demorado</strong>
                <br />
                <span className="micro">Local Palermo · 3 h sin recepción</span>
              </span>
              <span className="list-actions">
                <span className="badge bad">Crítica</span>
                <button
                  type="button"
                  className="button small"
                  onClick={() => navigate("/operador")}
                >
                  Registrar recepción
                </button>
              </span>
            </li>
            <li>
              <span>
                <strong>4 productos bajo mínimo</strong>
                <br />
                <span className="micro">CD Central · sugerencia calculada</span>
              </span>
              <span className="list-actions">
                <span className="badge warn">Stock</span>
                <button
                  type="button"
                  className="button small"
                  onClick={() => navigate("/logistica/wizard")}
                >
                  Crear reposición
                </button>
              </span>
            </li>
            <li>
              <span>
                <strong>2 bultos sin precinto</strong>
                <br />
                <span className="micro">Orden OR-000115</span>
              </span>
              <span className="list-actions">
                <span className="badge warn">Bloqueo</span>
                <button
                  type="button"
                  className="button small"
                  onClick={() => setDrawerPackage(true)}
                >
                  Asignar precintos
                </button>
              </span>
            </li>
          </ul>
        </article>

        <article className="card">
          <h2>Trabajo pendiente</h2>
          <ul className="list">
            <li>
              <span>Órdenes por preparar</span>
              <strong className="tabular">4</strong>
            </li>
            <li>
              <span>Remitos por despachar</span>
              <strong className="tabular">2</strong>
            </li>
            <li>
              <span>Bultos por verificar</span>
              <strong className="tabular">8</strong>
            </li>
          </ul>
          <button
            type="button"
            className="button primary"
            onClick={() => navigate("/logistica/kanban")}
          >
            Abrir operación activa
          </button>
        </article>
      </div>

      <article className="card dashboard-movements-card">
        <div className="row">
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
            <tr>
              <td className="tabular">14:31</td>
              <td>BU-000045</td>
              <td>Verificado</td>
              <td>
                <span className="row row-start">
                  <span className="avatar sm light">AR</span>
                  Ana Ruiz
                </span>
              </td>
              <td>Local Palermo</td>
              <td>+12 u. disponibles</td>
            </tr>
            <tr>
              <td className="tabular">14:26</td>
              <td>RM-000077</td>
              <td>Despachado</td>
              <td>Laura Pérez</td>
              <td>CD Central</td>
              <td>4 bultos en tránsito</td>
            </tr>
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
