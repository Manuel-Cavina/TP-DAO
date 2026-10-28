import { useCallback, useState } from "react";
import { toAppError } from "../../core/http";
import { useToast } from "../feedback/ToastContext";

/**
 * Mutaciones con pending, errores por campo y toasts centralizados.
 * Errores de validacion quedan en `fieldErrors` (sin toast); el resto notifica.
 */
export function useMutation(action, { successMessage, onSuccess } = {}) {
  const { notify, notifyError } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(
    async (...args) => {
      setPending(true);
      setError(null);
      try {
        const result = await action(...args);
        if (successMessage) notify({ tone: "success", title: successMessage });
        if (onSuccess) onSuccess(result);
        return { ok: true, data: result };
      } catch (raw) {
        const err = toAppError(raw);
        setError(err);
        if (err.kind !== "validation") notifyError(err);
        return { ok: false, error: err };
      } finally {
        setPending(false);
      }
    },
    [action, successMessage, onSuccess, notify, notifyError]
  );

  const reset = useCallback(() => setError(null), []);
  return { mutate, pending, error, fieldErrors: error?.fieldErrors || {}, reset };
}
