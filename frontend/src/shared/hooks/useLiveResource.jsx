import React, { useState, useEffect, useRef, useCallback } from "react";

/** Poll visible resources, retaining same-resource data on network failures. */
export function useLiveResource(fetcher, options = {}) {
  const { intervalMs = 15000, enabled = true, initialData = null, resourceKey = "default", onSuccess, onError } = options;
  const [state, setState] = useState(() => ({ key: resourceKey, data: initialData, error: null, lastUpdated: null, isLoading: enabled, isRefreshing: false }));
  const [now, setNow] = useState(Date.now());
  const fetcherRef = useRef(fetcher);
  const callbacksRef = useRef({ onSuccess, onError });
  const currentKeyRef = useRef(resourceKey);
  const requestRef = useRef({ sequence: 0, controller: null, active: false });
  fetcherRef.current = fetcher;
  callbacksRef.current = { onSuccess, onError };
  currentKeyRef.current = resourceKey;

  const executeFetch = useCallback(async (isBackground = false) => {
    if (!enabled || !requestRef.current.active) return { ok: false };
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++requestRef.current.sequence;
    requestRef.current.controller = controller;
    const isCurrent = () => requestRef.current.active && !controller.signal.aborted && sequence === requestRef.current.sequence && Object.is(currentKeyRef.current, resourceKey);
    setState((previous) => ({
      ...(Object.is(previous.key, resourceKey) ? previous : { key: resourceKey, data: initialData, error: null, lastUpdated: null }),
      isLoading: !isBackground, isRefreshing: isBackground,
    }));
    try {
      const result = await fetcherRef.current({ signal: controller.signal });
      if (!isCurrent()) return { ok: false, cancelled: true };
      const timestamp = Date.now();
      setState({ key: resourceKey, data: result, error: null, lastUpdated: timestamp, isLoading: false, isRefreshing: false });
      setNow(timestamp);
      callbacksRef.current.onSuccess?.(result);
      return { ok: true, data: result };
    } catch (error) {
      if (!isCurrent()) return { ok: false, cancelled: true };
      setState((previous) => ({ ...previous, error, isLoading: false, isRefreshing: false }));
      callbacksRef.current.onError?.(error);
      return { ok: false, error };
    }
  }, [enabled, resourceKey]);

  useEffect(() => {
    requestRef.current.active = enabled;
    if (!enabled) return undefined;
    executeFetch(false);
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      executeFetch(true);
    }, intervalMs);
    return () => {
      clearInterval(timer);
      requestRef.current.active = false;
      ++requestRef.current.sequence;
      requestRef.current.controller?.abort();
    };
  }, [enabled, resourceKey, intervalMs, executeFetch]);

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const current = Object.is(state.key, resourceKey)
    ? state
    : { data: initialData, error: null, lastUpdated: null, isLoading: enabled, isRefreshing: false };
  const freshnessSeconds = current.lastUpdated ? Math.max(0, Math.floor((now - current.lastUpdated) / 1000)) : 0;
  const refresh = useCallback(() => executeFetch(false), [executeFetch]);
  return { ...current, isLoading: enabled && current.isLoading, freshnessSeconds, isStale: Boolean(current.error) || freshnessSeconds > 15, refresh };
}

/**
 * Indicador visual de frescura que coincide con el prototipo (.live-indicator).
 */
export function LiveIndicator({ freshnessSeconds = 0, isStale = false, onRefresh }) {
  const label = freshnessSeconds === 0
    ? "Actualizado recién"
    : `Actualizado hace ${freshnessSeconds} s`;

  return (
    <div className={`live-indicator ${isStale ? "stale" : ""}`} title={isStale ? "Datos desactualizados" : "Datos en tiempo real"}>
      <span className="tabular">{label}</span>
      {isStale && onRefresh && (
        <button
          type="button"
          className="button ghost small"
          onClick={onRefresh}
          title="Recargar datos ahora"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export default useLiveResource;
