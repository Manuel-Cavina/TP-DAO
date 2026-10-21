import { useAsync, useMutation } from "../../../shared/hooks";
import { stockService } from "../services";
import { mapStockToUI } from "../mappers/stockMappers";

export function useStockMatriz({ ubicacionId } = {}) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      if (!ubicacionId) return [];
      const resp = await stockService.consultarPorUbicacion(ubicacionId, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapStockToUI);
    },
    [ubicacionId],
    { enabled: Boolean(ubicacionId) }
  );

  const ingresoMutation = useMutation(
    (dto) => stockService.ingresoCD(dto),
    { successMessage: "Mercadería ingresada en CD Central con éxito", onSuccess: reload }
  );

  const obtenerSaldoPorProducto = (productoId) => {
    if (!data) return 0;
    const item = data.find((s) => s.productoId === Number(productoId));
    return item ? item.disponible : 0;
  };

  return {
    stocks: data || [],
    status,
    loading,
    error,
    reload,
    ingresarCD: ingresoMutation.mutate,
    ingresoPending: ingresoMutation.pending,
    ingresoFieldErrors: ingresoMutation.fieldErrors,
    obtenerSaldoPorProducto,
  };
}
