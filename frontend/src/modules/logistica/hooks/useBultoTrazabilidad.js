import { useLiveResource } from "../../../shared/hooks";
import { logisticaService } from "../services";

export function useBultoTrazabilidad(bultoId) {
  const { data, error, refresh: reload, isLoading: loading, isStale, freshnessSeconds } = useLiveResource(
    async ({ signal }) => {
      if (!bultoId) return null;
      return logisticaService.consultarTrazabilidad(bultoId, { signal });
    },
    { resourceKey: `trace:${bultoId}`, enabled: Boolean(bultoId) }
  );

  return {
    trazabilidad: data,
    status: loading ? "loading" : error ? "error" : "success",
    isStale,
    freshnessSeconds,
    loading,
    error,
    reload,
  };
}
