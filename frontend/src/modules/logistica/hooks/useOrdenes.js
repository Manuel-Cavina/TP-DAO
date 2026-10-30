import { useLiveResource } from "../../../shared/hooks";
import { logisticaService } from "../services";
import { mapOrdenToUI } from "../mappers/logisticaMappers";

export function useOrdenes({ estado } = {}) {
  const { data, error, refresh: reload, isLoading: loading, isStale, freshnessSeconds } = useLiveResource(
    async ({ signal }) => {
      const resp = await logisticaService.listarOrdenes({ estado }, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapOrdenToUI);
    },
    { resourceKey: `orders:${estado || "all"}` }
  );

  return {
    ordenes: data || [],
    status: loading ? "loading" : error ? "error" : "success",
    isStale,
    freshnessSeconds,
    loading,
    error,
    reload,
  };
}
