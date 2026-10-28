import { useAsync } from "../../../shared/hooks";
import { logisticaService } from "../services";
import { mapOrdenToUI } from "../mappers/logisticaMappers";

export function useOrdenes({ estado } = {}) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await logisticaService.listarOrdenes({ estado }, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapOrdenToUI);
    },
    [estado]
  );

  return {
    ordenes: data || [],
    status,
    loading,
    error,
    reload,
  };
}
