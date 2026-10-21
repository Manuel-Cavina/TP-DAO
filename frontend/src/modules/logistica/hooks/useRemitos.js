import { useAsync, useMutation } from "../../../shared/hooks";
import { logisticaService } from "../services";
import { mapRemitoToUI } from "../mappers/logisticaMappers";

export function useRemitos() {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await logisticaService.listarRemitos({ signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapRemitoToUI);
    },
    []
  );

  const despacharMutation = useMutation(
    (numero) => logisticaService.despacharRemito(numero),
    { successMessage: "Remito despachado en tránsito", onSuccess: reload }
  );

  const recibirMutation = useMutation(
    (numero) => logisticaService.recibirRemito(numero),
    { successMessage: "Remito recibido físicamente en local", onSuccess: reload }
  );

  const cerrarMutation = useMutation(
    (numero) => logisticaService.cerrarRemito(numero),
    { successMessage: "Remito cerrado e impacto de stock / merma ejecutado", onSuccess: reload }
  );

  const verificarMutation = useMutation(
    ({ bultoId, codigoPrecinto, estaIntacto }) =>
      logisticaService.verificarBulto(bultoId, {
        codigoPrecintoRecibido: codigoPrecinto,
        estaIntacto,
      }),
    { successMessage: "Verificación de bulto registrada", onSuccess: reload }
  );

  return {
    remitos: data || [],
    status,
    loading,
    error,
    reload,
    despachar: despacharMutation.mutate,
    recibir: recibirMutation.mutate,
    cerrar: cerrarMutation.mutate,
    verificarBulto: verificarMutation.mutate,
    pendingAction:
      despacharMutation.pending ||
      recibirMutation.pending ||
      cerrarMutation.pending ||
      verificarMutation.pending,
  };
}
