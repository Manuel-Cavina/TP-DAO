import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../shared/feedback/ToastContext";

const MODAL_CONFIG = {
  receive: {
    title: "Registrar recepción",
    subtitle: "RM-000078 · En tránsito \u2192 Recibido",
    note: "Confirma el arribo de 3 bultos a Local Palermo. Todavía no se acreditará stock: cada precinto debe verificarse.",
  },
  verify: {
    title: "Verificar precinto intacto",
    subtitle: "BU-000045 · Recibido \u2192 Verificado",
    note: "Quedarán 12 unidades listas para acreditar en Local Palermo al cerrar el remito y se registrará evidencia del código PC-883102.",
  },
  reject: {
    title: "Registrar incidencia",
    subtitle: "BU-000045 · Recibido \u2192 Rechazado",
    note: "Debe indicar el motivo. Las 12 unidades se registrarán como merma al cerrar el remito y nunca ingresarán a disponible.",
  },
};

export function OperatorDashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedLocal, setSelectedLocal] = useState("Local Palermo · Recepción");
  const [modalType, setModalType] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [drawerVerifyAll, setDrawerVerifyAll] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setModalType(null);
        setDrawerVerifyAll(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleModalConfirm = () => {
    setModalType(null);
    setRejectReason("");
    toast("Acción registrada y añadida a la trazabilidad.");
  };

  const handleDrawerConfirm = () => {
    setDrawerVerifyAll(false);
    toast("3 resultados de precinto registrados con evidencia individual.");
  };

  return (
    <section className="screen no-shell active" id="operator">
      <main>
        <div className="mobile-stage">
          <div className="mobile-top">
            <img src="/brand/stocky-icon.png" alt="Stocky" className="mobile-brand-icon" />
            <div>
              <strong>Stocky Operaciones</strong>
              <br />
              <span className="micro">Sesión de Ana Ruiz</span>
            </div>
            <span className="flex-1" />
            <button
              type="button"
              className="icon-button notification-trigger"
              aria-label="Notificaciones"
              onClick={() => toast("2 notificaciones pendientes")}
            >
              &#x25C7;<span className="notification-dot" />
            </button>
            <span className="avatar">AR</span>
          </div>

          <div className="mobile-body">
            <div className="mobile-context">
              <div className="row">
                <div>
                  <span className="micro">Reportada a</span>
                  <br />
                  <strong>CD Central · Logística</strong>
                </div>
                <button
                  type="button"
                  className="button small"
                  onClick={() => toast("Abriendo selección de centro asignado")}
                >
                  Cambiar
                </button>
              </div>
              <hr className="mobile-divider" />
              <div className="field">
                <label htmlFor="operatorLocal">Local de trabajo actual</label>
                <select
                  className="select"
                  id="operatorLocal"
                  value={selectedLocal}
                  onChange={(e) => setSelectedLocal(e.target.value)}
                >
                  <option value="Local Palermo · Recepción">Local Palermo · Recepción</option>
                  <option value="Local Centro · Recepción">Local Centro · Recepción</option>
                </select>
                <span className="field-help">
                  Sólo aparecen locales asignados al operador para este turno.
                </span>
              </div>
              <p className="micro mobile-shift">
                Turno 08:00 &ndash; 16:00 · Supervisor: Martín Gómez
              </p>
            </div>

            <div className="page-head mobile-page-head">
              <div>
                <h1>Mi trabajo</h1>
                <p className="muted">3 acciones pendientes</p>
              </div>
              <span className="micro">Actualizado 5 s</span>
            </div>

            <article className="card action-panel">
              <div className="row">
                <span className="badge bad">Demorado</span>
                <span className="micro">hace 3 h</span>
              </div>
              <h2 className="mobile-card-title">Recibir RM-000078</h2>
              <p>
                CD Central &rarr; Local Palermo
                <br />
                3 bultos · 36 unidades
              </p>
              <button
                type="button"
                className="button primary w-full"
                onClick={() => setModalType("receive")}
              >
                Registrar recepción
              </button>
            </article>

            <article className="card mobile-card-gap">
              <div className="row">
                <span className="badge info">Recibido</span>
                <span className="micro">hace 8 min</span>
              </div>
              <h2 className="mobile-card-title">Verificar BU-000045</h2>
              <p>Precinto PC-883102 · 12 unidades</p>
              <button
                type="button"
                className="button primary w-full"
                onClick={() => setModalType("verify")}
              >
                Precinto intacto
              </button>
              <button
                type="button"
                className="button danger w-full mobile-btn-danger"
                onClick={() => setModalType("reject")}
              >
                Registrar incidencia
              </button>
              <button
                type="button"
                className="button w-full mobile-btn-control"
                onClick={() => setDrawerVerifyAll(true)}
              >
                Controlar todos los bultos
              </button>
            </article>

            <div className="validation-note mobile-card-gap">
              La pantalla siempre muestra centro de reporte, local seleccionado, turno, destino y efecto de la acción.
            </div>
          </div>

          <nav className="mobile-nav">
            <button type="button" className="active">Trabajo</button>
            <button
              type="button"
              onClick={() => toast("Escáner listo para orden, remito, bulto o precinto")}
            >
              Escanear
            </button>
            <button
              type="button"
              onClick={() => navigate("/logistica/trazabilidad")}
            >
              Historial
            </button>
            <button
              type="button"
              onClick={() => toast("Abriendo perfil y asignaciones")}
            >
              Perfil
            </button>
          </nav>
        </div>
      </main>

      {modalType && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalType(null);
          }}
        >
          <section className="modal-wrap">
            <div className="drawer-head">
              <div>
                <h2 id="modalTitle">{MODAL_CONFIG[modalType].title}</h2>
                <p className="muted" id="modalSubtitle">
                  {MODAL_CONFIG[modalType].subtitle}
                </p>
              </div>
              <button
                type="button"
                className="icon-button overlay-close"
                aria-label="Cerrar"
                onClick={() => setModalType(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="validation-note">{MODAL_CONFIG[modalType].note}</div>
              {modalType === "reject" && (
                <div className="field modal-reject-field">
                  <label htmlFor="modalRejectReason">Motivo obligatorio</label>
                  <textarea
                    id="modalRejectReason"
                    rows={3}
                    maxLength={250}
                    placeholder="Describa el daño o diferencia observada"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <span className="field-help">Texto plano, máximo 250 caracteres.</span>
                </div>
              )}
              <ul className="list">
                <li>
                  <span>Datos actualizados</span>
                  <strong>hace 4 s</strong>
                </li>
                <li>
                  <span>Evidencia</span>
                  <strong>Usuario · sede · fecha · documento</strong>
                </li>
              </ul>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="button overlay-close"
                onClick={() => setModalType(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleModalConfirm}
              >
                Confirmar y registrar
              </button>
            </div>
          </section>
        </div>
      )}

      {drawerVerifyAll && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verifyAllTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerVerifyAll(false);
          }}
        >
          <aside className="drawer">
            <div className="drawer-head">
              <div>
                <h2 id="verifyAllTitle">Controlar todos los precintos</h2>
                <p className="muted" id="verifyAllSubtitle">RM-000078 · Local Palermo</p>
              </div>
              <button
                type="button"
                className="icon-button overlay-close"
                aria-label="Cerrar"
                onClick={() => setDrawerVerifyAll(false)}
              >
                &times;
              </button>
            </div>
            <div className="drawer-body">
              <div className="stepper">
                <div className="step done">Remito recibido</div>
                <div className="step current">Escanear</div>
                <div className="step">Resultados</div>
                <div className="step">Confirmar</div>
              </div>
              <p>Control por lote de RM-000078. Cada precinto debe escanearse o ingresarse y conserva su propio resultado.</p>
              <table className="verify-table">
                <thead>
                  <tr>
                    <th className="verify-col-package">Bulto</th>
                    <th className="verify-col-expected">Precinto esperado</th>
                    <th className="verify-col-read">Lectura</th>
                    <th className="verify-col-result">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>BU-000045</td>
                    <td>PC-883102</td>
                    <td><input className="input" defaultValue="PC-883102" /></td>
                    <td>
                      <select className="select">
                        <option>Íntegro</option>
                        <option>Violado</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>BU-000046</td>
                    <td>PC-883103</td>
                    <td><input className="input" defaultValue="PC-883103" /></td>
                    <td>
                      <select className="select">
                        <option>Íntegro</option>
                        <option>Violado</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>BU-000047</td>
                    <td>PC-883104</td>
                    <td><input className="input" defaultValue="PC-883104" /></td>
                    <td>
                      <select className="select">
                        <option>Íntegro</option>
                        <option>Violado</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="validation-note drawer-validation-note">
                &ldquo;Confirmar 3 resultados&rdquo; no significa aprobar a ciegas: valida cada lectura, exige motivo si se elige Violado y genera tres eventos de trazabilidad.
              </div>
            </div>
            <div className="drawer-foot">
              <button
                type="button"
                className="button overlay-close"
                onClick={() => setDrawerVerifyAll(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleDrawerConfirm}
              >
                Confirmar 3 resultados
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default OperatorDashboardPage;
