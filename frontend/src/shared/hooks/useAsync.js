import { useCallback, useEffect, useRef, useState } from "react";
import { toAppError } from "../../core/http";

/**
 * Carga de datos con estados explicitos: idle | loading | success | error.
 * `fetcher` recibe { signal }. Se vuelve a ejecutar cuando cambian `deps`.
 */
export function useAsync(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, status: enabled ? "loading" : "idle" });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    fetcherRef
      .current({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, status: "success" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState((prev) => ({ data: prev.data, error: toAppError(error), status: "error" }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload, loading: state.status === "loading" };
}
