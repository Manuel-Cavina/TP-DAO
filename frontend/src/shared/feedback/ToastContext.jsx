import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ToastStack } from "../components/Motion";
import { toAppError, AppError } from "../../core/http";

const ToastContext = createContext(null);
const TOAST_MS = 4500;

const ERROR_TITLES = {
  network: "Sin conexión con el servidor",
  validation: "Datos inválidos",
  domain: "Operación rechazada",
  conflict: "Conflicto con datos existentes",
  not_found: "No encontrado",
  server: "Error del servidor",
  unknown: "Error inesperado",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (payload) => {
      const { tone = "success", title, description } =
        typeof payload === "string" ? { title: payload } : payload;
      seq.current += 1;
      const id = seq.current;
      setToasts((prev) => [...prev, { id, tone, title, description }]);
      setTimeout(() => dismiss(id), TOAST_MS);
      return id;
    },
    [dismiss]
  );

  /**
   * Notificación específica de éxito según FR-017 / FR-038 y contrato UI:
   * "Successful mutations show a specific toast containing entity and result."
   * Soporta:
   *  - notifySuccess("Producto", "SKU-104 creado exitosamente.")
   *  - notifySuccess("Operación completada")
   *  - notifySuccess({ entity: "Producto", result: "creado correctamente", detail: "SKU-104" })
   */
  const notifySuccess = useCallback(
    (titleOrPayload, description) => {
      if (typeof titleOrPayload === "string") {
        if (description !== undefined) {
          return notify({ tone: "success", title: titleOrPayload, description });
        }
        return notify({ tone: "success", title: titleOrPayload });
      }
      if (titleOrPayload && typeof titleOrPayload === "object") {
        const { entity, result, detail, title, description: desc, message } = titleOrPayload;
        const finalTitle =
          title ||
          (entity && result
            ? `${entity}: ${result}`
            : entity || result || "Operación completada");
        const finalDesc = desc || detail || message;
        return notify({ tone: "success", title: finalTitle, description: finalDesc });
      }
      return notify({ tone: "success", title: "Operación completada" });
    },
    [notify]
  );

  /**
   * Notificación específica de error según FR-017 / FR-038:
   * Soporta AppError, strings, y opciones de contexto `{ entity, action, title, description }`.
   * Preserva validaciones a nivel de campo en el formulario.
   */
  const notifyError = useCallback(
    (error, options = {}) => {
      let err;
      if (typeof error === "string") {
        err = new AppError({ kind: "domain", message: error });
      } else {
        err = toAppError(error);
      }

      const entity = options.entity || options.entidad;
      const action = options.action || options.accion;
      const baseTitle = ERROR_TITLES[err.kind] || ERROR_TITLES.unknown;

      let title = options.title;
      if (!title) {
        if (entity && action) {
          title = `${entity}: Error al ${action}`;
        } else if (entity) {
          title = `${entity}: ${baseTitle}`;
        } else {
          title = baseTitle;
        }
      }

      const description = options.description || err.message;
      const tone = err.kind === "conflict" ? "warning" : "danger";

      return notify({ tone, title, description });
    },
    [notify]
  );

  const notifyWarning = useCallback(
    (titleOrPayload, description) => {
      if (typeof titleOrPayload === "string") {
        return notify({ tone: "warning", title: titleOrPayload, description });
      }
      return notify({ tone: "warning", ...titleOrPayload });
    },
    [notify]
  );

  const toast = useMemo(() => {
    const fn = (payload) => notify(payload);
    fn.success = (title, desc) => notifySuccess(title, desc);
    fn.error = (err, opts) => notifyError(err, opts);
    fn.warning = (title, desc) => notifyWarning(title, desc);
    fn.dismiss = dismiss;
    return fn;
  }, [notify, notifySuccess, notifyError, notifyWarning, dismiss]);

  const value = useMemo(
    () => ({
      notify,
      toast,
      notifySuccess,
      notifyError,
      notifyWarning,
      dismiss,
    }),
    [notify, toast, notifySuccess, notifyError, notifyWarning, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
