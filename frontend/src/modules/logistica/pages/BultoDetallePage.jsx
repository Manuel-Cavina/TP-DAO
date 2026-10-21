import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../../../shared/feedback/ToastContext";

export function BultoDetallePage() {
  const { id = "BU-000045" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const bultoCodigo = id || "BU-000045";
  const [estadoBadge, setEstadoBadge] = useState({ text: "Recibido", tone: "info" });
  const [modalType, setModalType] = useState(null); // 'verify' | 'reject' | null
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

  const handleVerifyConfirm = () => {
    setEstadoBadge({ text: "Verificado", tone: "ok" });
    setModalType(null);
    toast("Acción registrada y añadida a la trazabilidad.");
  };

  const handleRejectConfirm = () => {
    setEstadoBadge({ text: "Rechazado", tone: "bad" });
    setModalType(null);
    setRejectReason("");
    toast("Acción registrada y añadida a la trazabilidad.");
  };

  const handleDrawerConfirm = () => {
    setDrawerVerifyAll(false);
    toast("3 resultados de precinto registrados con evidencia individual.");
  };

  return (
    <section className="screen" id="bulto">
      <div className="workspace">
        <main>
          <div className="page-head">
            <div>
              <p className="micro">Bultos / {bultoCodigo}</p>
              <div className="row row-start">
                <h1>Bulto {bultoCodigo}</h1>
                <span className={`badge ${estadoBadge.tone}`}>{estadoBadge.text}</span>
              </div>
              <p className="muted">Precinto PC-883102 · RM-000078 · OR-000112</p>
            </div>
            <span className="micro">Actualizado hace 5 s</span>
          </div>

          <div className="grid two">
            <div className="grid">
              <article className="card">
                <h2>Contenido e impacto</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Cantidad</th>
                      <th>Situación</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>SKU-104 · Yerba 1 kg</td>
                      <td className="num">8</td>
                      <td>En tránsito recibido</td>
                    </tr>
                    <tr>
                      <td>SKU-229 · Café 500 g</td>
                      <td className="num">4</td>
                      <td>En tránsito recibido</td>
                    </tr>
                  </tbody>
                </table>
                <div className="validation-note mt-3">
                  Intacto: 12 unidades quedan listas para acreditar al cerrar el remito. Violado: se registrarán como merma al cierre.
                </div>
              </article>

              <article className="card">
                <h2>Trazabilidad</h2>
                <ul className="timeline">
                  <li>
                    <strong>Recibido</strong>
                    <br />
                    <span className="micro">Ana Ruiz · Local Palermo · 14:32</span>
                  </li>
                  <li>
                    <strong>En tránsito</strong>
                    <br />
                    <span className="micro">Laura Pérez · CD Central · RM-000078</span>
                  </li>
                  <li>
                    <strong>Precintado</strong>
                    <br />
                    <span className="micro">Martín Gómez · PC-883102</span>
                  </li>
                </ul>
              </article>
            </div>

            <aside className="card action-panel">
              <h2>Verificar precinto</h2>
              <p>
                Compare físicamente el código con <strong>PC-883102</strong>.
              </p>
              <button
                type="button"
                className="button primary"
                data-confirm="verify"
                onClick={() => setModalType("verify")}
              >
                Precinto intacto
              </button>
              <button
                type="button"
                className="button danger action-panel-btn-gap"
                data-confirm="reject"
                onClick={() => setModalType("reject")}
              >
                Registrar incidencia
              </button>
              <button
                type="button"
                className="button action-panel-btn-gap"
                onClick={() => setDrawerVerifyAll(true)}
              >
                Controlar todos los bultos del remito
              </button>
              <button
                type="button"
                className="button ghost action-panel-btn-gap"
                data-go="trace"
                onClick={() => navigate("/logistica/trazabilidad")}
              >
                Ver trazabilidad completa
              </button>
            </aside>
          </div>
        </main>
      </div>

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
                <h2 id="modalTitle">
                  {modalType === "verify" ? "Verificar precinto intacto" : "Registrar incidencia"}
                </h2>
                <p className="muted" id="modalSubtitle">
                  {modalType === "verify"
                    ? `${bultoCodigo} · Recibido \u2192 Verificado`
                    : `${bultoCodigo} · Recibido \u2192 Rechazado`}
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
              <div className="validation-note">
                {modalType === "verify"
                  ? "Quedarán 12 unidades listas para acreditar en Local Palermo al cerrar el remito y se registrará evidencia del código PC-883102."
                  : "Debe indicar el motivo. Las 12 unidades se registrarán como merma al cerrar el remito y nunca ingresarán a disponible."}
              </div>
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
                onClick={modalType === "verify" ? handleVerifyConfirm : handleRejectConfirm}
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
              <p>
                Control por lote de RM-000078. Cada precinto debe escanearse o ingresarse y conserva su propio resultado.
              </p>
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
                      <select className="select" defaultValue="Íntegro">
                        <option value="Íntegro">Íntegro</option>
                        <option value="Violado">Violado</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>BU-000046</td>
                    <td>PC-883103</td>
                    <td><input className="input" defaultValue="PC-883103" /></td>
                    <td>
                      <select className="select" defaultValue="Íntegro">
                        <option value="Íntegro">Íntegro</option>
                        <option value="Violado">Violado</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>BU-000047</td>
                    <td>PC-883104</td>
                    <td><input className="input" defaultValue="PC-883104" /></td>
                    <td>
                      <select className="select" defaultValue="Íntegro">
                        <option value="Íntegro">Íntegro</option>
                        <option value="Violado">Violado</option>
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

export default BultoDetallePage;
