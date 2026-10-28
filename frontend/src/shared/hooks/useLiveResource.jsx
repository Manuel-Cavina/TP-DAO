import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * useLiveResource (`frontend/src/shared/hooks/useLiveResource.jsx`)
 * Contrato de frescura operativo (FR-028, SC-014):
 * - Refresco automatico cada 15 segundos mientras la ventana este visible.
 * - Conserva los ultimos datos conocidos ante fallo de red (sin limpiar la pantalla).
 * - Calcula la antiguedad de los datos (`freshnessSeconds`) y marca `isStale` si supera 15 s.
 * - Permite forzar refresco inmediato con `refresh()`.
 */
export function useLiveResource(fetcher, options = {}) {
  const {
    intervalMs = 15000,
    enabled = true,
    initialData = null,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(initialData === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const executeFetch = useCallback(
    async (isBackground = false) => {
      if (!enabled) return;
      if (isBackground) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      try {
        const result = await fetcherRef.current();
        setData(result);
        setError(null);
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        setNow(timestamp);
        if (onSuccess) onSuccess(result);
      } catch (err) {
        // En fallo, preservamos la ultima version conocida de 'data' sin resetearla
        setError(err);
        if (onError) onError(err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [enabled, onSuccess, onError]
  );

  // Intervalo de recarga de 15 segundos
  useEffect(() => {
    if (!enabled) return;

    // Carga inicial
    executeFetch(false);

    const intervalTimer = setInterval(() => {
      // Solo refresca si la pestana esta activa/visible
      if (typeof document !== "undefined" && document.hidden) return;
      executeFetch(true);
    }, intervalMs);

    return () => clearInterval(intervalTimer);
  }, [enabled, intervalMs, executeFetch]);

  // Timer local para calcular los segundos transcurridos
  useEffect(() => {
    if (!lastUpdated) return;
    const ticker = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastUpdated]);

  const freshnessSeconds = lastUpdated
    ? Math.max(0, Math.floor((now - lastUpdated) / 1000))
    : 0;

  // Stale si paso mas de 15 segundos o si la ultima peticion dio error
  const isStale = Boolean(error) || freshnessSeconds > 15;

  const refresh = useCallback(() => executeFetch(false), [executeFetch]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    lastUpdated,
    freshnessSeconds,
    isStale,
    refresh,
  };
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
