import { AppError } from "./AppError.js";

/**
 * Contrato del backend (config/api/exception_handlers.py):
 *  - 400 validacion de Pydantic: detail = [{ loc, msg, type }]
 *  - 400 regla de negocio: detail = "mensaje"
 *  - 404 Entidad_No_Encontrada, 409 Entidad_Duplicada, 500 generico
 */

const FIELD_SKIP = new Set(["body", "query", "path"]);

function fieldErrorsFromList(list) {
  const out = {};
  list.forEach((item) => {
    const loc = Array.isArray(item?.loc) ? item.loc.filter((p) => !FIELD_SKIP.has(p)) : [];
    const key = loc.length ? loc.join(".") : "_form";
    if (!out[key]) out[key] = item?.msg || "Valor invalido";
  });
  return out;
}

function summaryFromFields(fields) {
  const entries = Object.entries(fields);
  if (!entries.length) return "Revisa los datos ingresados.";
  return entries.map(([k, v]) => (k === "_form" ? v : `${k}: ${v}`)).join(" · ");
}

export function mapNetworkError(error) {
  const aborted = error?.name === "AbortError";
  return new AppError({
    kind: "network",
    retryable: true,
    message: aborted
      ? "El servidor tardo demasiado en responder."
      : "No se pudo conectar con el servidor. Verifica que el backend este activo.",
  });
}

export function mapHttpError(status, payload) {
  const detail = payload && typeof payload === "object" ? payload.detail : payload;

  if (status === 400 && Array.isArray(detail)) {
    const fieldErrors = fieldErrorsFromList(detail);
    return new AppError({ kind: "validation", status, fieldErrors, message: summaryFromFields(fieldErrors), detail });
  }
  const text = typeof detail === "string" && detail ? detail : null;

  if (status === 404) return new AppError({ kind: "not_found", status, message: text || "No se encontro el recurso solicitado.", detail });
  if (status === 409) return new AppError({ kind: "conflict", status, message: text || "La operacion genera un conflicto con datos existentes.", detail });
  if (status >= 500) {
    return new AppError({ kind: "server", status, retryable: true, message: "Error interno del servidor. Intenta nuevamente.", detail });
  }
  return new AppError({ kind: "domain", status, message: text || `Solicitud rechazada (HTTP ${status}).`, detail });
}
