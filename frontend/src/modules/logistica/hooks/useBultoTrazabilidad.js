import { useAsync } from "../../../shared/hooks";
import { logisticaService } from "../services";

export function useBultoTrazabilidad(bultoId) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      if (!bultoId) return null;
      return logisticaService.consultarTrazabilidad(bultoId, { signal });
    },
    [bultoId],
    { enabled: Boolean(bultoId) }
  );

  return {
    trazabilidad: data,
    status,
    loading,
    error,
    reload,
  };
}
