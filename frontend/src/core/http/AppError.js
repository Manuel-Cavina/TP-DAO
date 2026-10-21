/**
 * Error unico que ve la UI. Los servicios nunca exponen Response ni errores crudos.
 * kind: network | validation | domain | not_found | conflict | server | unknown
 */
export class AppError extends Error {
  constructor({ kind = "unknown", status = 0, message, fieldErrors = {}, retryable = false, detail = null }) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryable = retryable;
    this.detail = detail;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}

export function toAppError(error) {
  if (isAppError(error)) return error;
  return new AppError({ kind: "unknown", message: error?.message || "Ocurrio un error inesperado." });
}
