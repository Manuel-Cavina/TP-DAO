import React, { useContext } from "react";
import { PrototypeContext } from "../feedback/PrototypeContext";
import {
  ApprovePackagesDrawerBody,
  BulkDrawerBody,
  PackageDrawerBody,
  ProductDrawerBody,
  VerifyAllDrawerBody,
} from "./WireframeDrawerBodies";

const DRAWER_CONFIG = {
  product: {
    title: "Nuevo producto",
    subtitle: "Wizard de alta en catálogo",
    saveLabel: "Revisar y guardar",
    defaultToast: "Producto revisado. El backend volverá a validar antes de guardar.",
  },
  package: {
    title: "Crear o completar bulto",
    subtitle: "Orden OR-000118 · CD Central → Local Palermo",
    saveLabel: "Crear bulto",
    defaultToast: "Bulto creado y trazabilidad actualizada.",
  },
  bulk: {
    title: "Actualizar precios por porcentaje",
    subtitle: "3 productos seleccionados",
    saveLabel: "Revisar 3 cambios",
    defaultToast: "3 cambios porcentuales listos para confirmación atómica.",
  },
  approvePackages: {
    title: "Aprobar bultos para remito",
    subtitle: "Orden OR-000118",
    saveLabel: "Aprobar 2 bultos listos",
    defaultToast: "2 bultos aprobados individualmente; BU-000045 continúa bloqueado.",
  },
  verifyAll: {
    title: "Controlar todos los precintos",
    subtitle: "RM-000078 · Local Palermo",
    saveLabel: "Confirmar 3 resultados",
    defaultToast: "3 resultados de precinto registrados con evidencia individual.",
  },
};

const CONFIRMATION_CONFIG = {
  dispatch: {
    title: "Registrar despacho completo",
    subtitle: "RM-000077 · Emitido → Despachado",
    note: "Los 4 bultos pasarán juntos a tránsito hacia Local Sur. Se registrarán actor, fecha, origen, destino y 48 unidades en tránsito.",
  },
  receive: {
    title: "Registrar recepción",
    subtitle: "RM-000078 · En tránsito → Recibido",
    note: "Confirma el arribo de 3 bultos a Local Palermo. Todavía no se acreditará stock: cada precinto debe verificarse.",
  },
  verify: {
    title: "Verificar precinto intacto",
    subtitle: "BU-000045 · Recibido → Verificado",
    note: "Quedarán 12 unidades listas para acreditar en Local Palermo al cerrar el remito y se registrará evidencia del código PC-883102.",
  },
  reject: {
    title: "Registrar incidencia",
    subtitle: "BU-000045 · Recibido → Rechazado",
    note: "Debe indicar el motivo. Las 12 unidades se registrarán como merma al cerrar el remito y nunca ingresarán a disponible.",
  },
  pdf: {
    title: "Generar PDF formal",
    subtitle: "R1 · Snapshot de existencias",
    note: "El documento conservará filtros, fecha, responsable, KPIs, gráficos y anexo tabular. No imprimirá controles del dashboard.",
  },
  pdf2: {
    title: "Generar PDF formal",
    subtitle: "R2 · Snapshot de mermas y precintos",
    note: "El documento conservará período, local, responsable, tasa coherente, incidentes, precintos, pérdidas y anexos forenses.",
  },
  transition: {
    title: "Completar acción",
    subtitle: "Transición de estado",
    note: "Revise los requisitos y confirme para mover la tarjeta a la siguiente etapa.",
  },
};

function DrawerOverlay({ activeDrawer, drawerData, closeDrawer, toast }) {
  if (!activeDrawer) return null;

  const config = DRAWER_CONFIG[activeDrawer] || {};
  const title = drawerData?.title || config.title || "Detalle";
  const subtitle = drawerData?.subtitle || config.subtitle || "";
  const saveLabel = drawerData?.saveLabel || config.saveLabel || "Revisar y guardar";

  const handleSave = () => {
    const message = drawerData?.toastMessage || config.defaultToast || "Acción revisada.";
    closeDrawer();
    toast(message);
    if (drawerData?.onSave) {
      drawerData.onSave();
    }
  };

  const handleCancel = () => {
    closeDrawer();
    if (drawerData?.onCancel) {
      drawerData.onCancel();
    }
  };

  return (
    <div className="overlay" id="drawerOverlay" aria-modal="true" role="dialog">
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
        <div className="drawer-head">
          <div>
            <h2 id="drawerTitle">{title}</h2>
            <p className="muted" id="drawerSubtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="icon-button overlay-close"
            aria-label="Cerrar"
            onClick={handleCancel}
          >
            ×
          </button>
        </div>
        <div className="drawer-body" id="drawerBody">
          {activeDrawer === "product" && <ProductDrawerBody />}
          {activeDrawer === "package" && <PackageDrawerBody />}
          {activeDrawer === "bulk" && <BulkDrawerBody />}
          {activeDrawer === "approvePackages" && <ApprovePackagesDrawerBody onToast={toast} />}
          {activeDrawer === "verifyAll" && <VerifyAllDrawerBody />}
        </div>
        <div className="drawer-foot">
          <button type="button" className="button overlay-close" onClick={handleCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="button primary"
            id="drawerSave"
            data-drawer-type={activeDrawer}
            onClick={handleSave}
          >
            {saveLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}

function ModalOverlay({ activeModal, modalData, closeModal, toast }) {
  if (!activeModal) return null;

  const config = CONFIRMATION_CONFIG[activeModal] || {};

  let title = config.title || "Confirmar acción";
  let subtitle = config.subtitle || "";
  let note = config.note || "";

  if (Array.isArray(modalData)) {
    if (modalData[0]) title = modalData[0];
    if (modalData[1]) subtitle = modalData[1];
    if (modalData[2]) note = modalData[2];
  } else if (modalData && typeof modalData === "object") {
    if (modalData.title) title = modalData.title;
    if (modalData.subtitle) subtitle = modalData.subtitle;
    if (modalData.note || modalData.message) note = modalData.note || modalData.message;
  }

  const isPdf = activeModal === "pdf" || activeModal === "pdf2";
  const defaultConfirmLabel = isPdf ? "Generar y descargar" : "Confirmar y registrar";
  const confirmLabel = modalData?.confirmLabel || defaultConfirmLabel;

  const handleConfirm = () => {
    const defaultToast = isPdf
      ? "PDF formal en generación. Se descargará al completar las validaciones."
      : "Acción registrada y añadida a la trazabilidad.";
    const toastMsg = modalData?.toastMessage || defaultToast;
    closeModal();
    toast(toastMsg);
    if (modalData?.onConfirm) {
      modalData.onConfirm();
    }
  };

  const handleCancel = () => {
    closeModal();
    if (modalData?.onCancel) {
      modalData.onCancel();
    }
  };

  return (
    <div className="overlay" id="modalOverlay" aria-modal="true" role="dialog">
      <section className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="drawer-head">
          <div>
            <h2 id="modalTitle">{title}</h2>
            <p className="muted" id="modalSubtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="icon-button overlay-close"
            aria-label="Cerrar"
            onClick={handleCancel}
          >
            ×
          </button>
        </div>
        <div className="modal-body" id="modalBody">
          <div className="validation-note">{note}</div>
          {activeModal === "reject" && (
            <div className="field mt-3">
              <label>Motivo obligatorio</label>
              <textarea
                rows={3}
                maxLength={250}
                placeholder="Describa el daño o diferencia observada"
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
          <button type="button" className="button overlay-close" onClick={handleCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="button primary"
            id="modalConfirm"
            data-action={activeModal}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function WireframeToastStack({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-stack" id="toastStack" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className="toast">
          <span className="micro">Listo</span>
          <span>{item.message}</span>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => removeToast(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function WireframeOverlays() {
  const proto = useContext(PrototypeContext);
  if (!proto) return null;

  const {
    activeDrawer,
    drawerData,
    closeDrawer,
    activeModal,
    modalData,
    closeModal,
    toasts,
    toast,
    removeToast,
  } = proto;

  return (
    <>
      <DrawerOverlay
        activeDrawer={activeDrawer}
        drawerData={drawerData}
        closeDrawer={closeDrawer}
        toast={toast}
      />
      <ModalOverlay
        activeModal={activeModal}
        modalData={modalData}
        closeModal={closeModal}
        toast={toast}
      />
      <WireframeToastStack toasts={toasts} removeToast={removeToast} />
    </>
  );
}

export default WireframeOverlays;
