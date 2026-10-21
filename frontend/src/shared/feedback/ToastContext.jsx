import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ToastStack } from "../components/Motion";
import { toAppError } from "../../core/http";

const ToastContext = createContext(null);
const TOAST_MS = 4500;

const ERROR_TITLES = {
  network: "Sin conexion con el servidor",
  validation: "Datos invalidos",
  domain: "Operacion rechazada",
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
    },
    [dismiss]
  );

  const notifyError = useCallback(
    (error) => {
      const err = toAppError(error);
      notify({ tone: err.kind === "conflict" ? "warning" : "danger", title: ERROR_TITLES[err.kind], description: err.message });
    },
    [notify]
  );

  const value = useMemo(() => ({ notify, toast: notify, notifyError }), [notify, notifyError]);

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
