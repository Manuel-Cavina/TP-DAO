import { useCallback } from "react";
import { useLiveResource, useMutation } from "../../../shared/hooks";
import { stockService } from "../services";
import { mapStockToUI } from "../mappers/stockMappers";

export function useStockMatriz({ ubicacionId, intervalMs = 15000 } = {}) {
  const fetchStock = useCallback(async ({ signal }) => {
    const response = await stockService.consultarPorUbicacion(ubicacionId, { signal });
    const items = Array.isArray(response) ? response : response?.data || [];
    return items.map(mapStockToUI);
  }, [ubicacionId]);
  const resource = useLiveResource(fetchStock, {
    resourceKey: `stock:${ubicacionId || "none"}`,
    enabled: Boolean(ubicacionId),
    intervalMs,
  });
  const stocks = resource.data || [];
  const ingresoMutation = useMutation(
    (dto) => stockService.ingresoCD(dto),
    { successMessage: "Mercadería ingresada en CD con éxito", onSuccess: resource.refresh }
  );
  return {
    stocks,
    loading: resource.isLoading,
    error: resource.error,
    reload: resource.refresh,
    freshnessSeconds: resource.freshnessSeconds,
    isStale: resource.isStale,
    lastUpdated: resource.lastUpdated,
    ingresarCD: ingresoMutation.mutate,
    ingresoPending: ingresoMutation.pending,
    ingresoFieldErrors: ingresoMutation.fieldErrors,
    obtenerSaldoPorProducto: (productoId) => stocks.find((stock) => stock.productoId === Number(productoId))?.disponible || 0,
  };
}

export default useStockMatriz;
