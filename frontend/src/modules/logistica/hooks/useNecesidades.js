import { useAsync, useMutation } from "../../../shared/hooks";
import { logisticaService } from "../services";
import { mapNecesidadToUI } from "../mappers/logisticaMappers";

export function useNecesidades({ localId } = {}) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await logisticaService.listarNecesidades({ localId }, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapNecesidadToUI);
    },
    [localId]
  );

  const consolidarMutation = useMutation(
    ({ localDestinoId, origenId }) =>
      logisticaService.consolidarOrden({ localDestinoId, origenId }),
    { successMessage: "Orden de reposición consolidada con éxito", onSuccess: reload }
  );

  return {
    necesidades: data || [],
    status,
    loading,
    error,
    reload,
    consolidar: consolidarMutation.mutate,
    consolidarPending: consolidarMutation.pending,
  };
}
