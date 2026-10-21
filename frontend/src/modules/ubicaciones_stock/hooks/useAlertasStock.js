import { useAsync, useMutation } from "../../../shared/hooks";
import { stockService } from "../services";
import { mapAlertaToUI } from "../mappers/stockMappers";

export function useAlertasStock({ soloNoLeidas = false, ubicacionId } = {}) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await stockService.listarAlertas({ soloNoLeidas, ubicacionId }, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapAlertaToUI);
    },
    [soloNoLeidas, ubicacionId]
  );

  const marcarMutation = useMutation(
    (alertaId) => stockService.marcarAlertaLeida(alertaId),
    { successMessage: "Alerta marcada como resuelta", onSuccess: reload }
  );

  return {
    alertas: data || [],
    status,
    loading,
    error,
    reload,
    marcarLeida: marcarMutation.mutate,
    marcarPending: marcarMutation.pending,
  };
}
