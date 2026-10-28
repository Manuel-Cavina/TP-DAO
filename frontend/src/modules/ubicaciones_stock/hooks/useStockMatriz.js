import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "../../../shared/hooks";
import { stockService } from "../services";
import { mapStockToUI } from "../mappers/stockMappers";

/**
 * useStockMatriz (`frontend/src/modules/ubicaciones_stock/hooks/useStockMatriz.js`)
 * Consulta la matriz de existencias para una ubicacion con frescura en vivo 15s (FR-028).
 */
export function useStockMatriz({ ubicacionId, intervalMs = 15000 } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(Boolean(ubicacionId));
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStock = useCallback(async (isBackground = false) => {
    if (!ubicacionId) {
      setData([]);
      setLoading(false);
      return;
    }

    if (!isBackground) setLoading(true);

    try {
      const resp = await stockService.consultarPorUbicacion(ubicacionId);
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      const mapped = items.map(mapStockToUI);

      if (isMountedRef.current) {
        setData(mapped);
        setError(null);
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        setNow(timestamp);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [ubicacionId]);

  useEffect(() => {
    if (!ubicacionId) return;

    fetchStock(false);

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchStock(true);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [ubicacionId, intervalMs, fetchStock]);

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

  const isStale = Boolean(error) || freshnessSeconds > 15;

  const ingresoMutation = useMutation(
    (dto) => stockService.ingresoCD(dto),
    { successMessage: "Mercadería ingresada en CD con éxito", onSuccess: () => fetchStock(false) }
  );

  const obtenerSaldoPorProducto = (productoId) => {
    if (!data) return 0;
    const item = data.find((s) => s.productoId === Number(productoId));
    return item ? item.disponible : 0;
  };

  return {
    stocks: data,
    loading,
    error,
    reload: () => fetchStock(false),
    freshnessSeconds,
    isStale,
    lastUpdated,
    ingresarCD: ingresoMutation.mutate,
    ingresoPending: ingresoMutation.pending,
    ingresoFieldErrors: ingresoMutation.fieldErrors,
    obtenerSaldoPorProducto,
  };
}

export default useStockMatriz;
