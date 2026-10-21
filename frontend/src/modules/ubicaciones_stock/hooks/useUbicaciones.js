import { useAsync, useMutation } from "../../../shared/hooks";
import { ubicacionesService } from "../services";
import { mapUbicacionToUI } from "../mappers/stockMappers";

export function useUbicaciones({ activas = true } = {}) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await ubicacionesService.listar({ activas }, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapUbicacionToUI);
    },
    [activas]
  );

  const crearCDMutation = useMutation(
    (dto) => ubicacionesService.crearCD(dto),
    { successMessage: "Centro de distribución creado exitosamente", onSuccess: reload }
  );

  const crearLocalMutation = useMutation(
    (dto) => ubicacionesService.crearLocal(dto),
    { successMessage: "Local comercial creado exitosamente", onSuccess: reload }
  );

  const actualizarMutation = useMutation(
    ({ id, dto }) => ubicacionesService.actualizar(id, dto),
    { successMessage: "Ubicación actualizada correctamente", onSuccess: reload }
  );

  const bajaMutation = useMutation(
    (id) => ubicacionesService.darDeBaja(id),
    { successMessage: "Ubicación dada de baja lógica", onSuccess: reload }
  );

  const reactivarMutation = useMutation(
    (id) => ubicacionesService.reactivar(id),
    { successMessage: "Ubicación reactivada exitosamente", onSuccess: reload }
  );

  return {
    ubicaciones: data || [],
    status,
    loading,
    error,
    reload,
    crearCD: crearCDMutation.mutate,
    crearLocal: crearLocalMutation.mutate,
    pendingCrear: crearCDMutation.pending || crearLocalMutation.pending,
    actualizar: actualizarMutation.mutate,
    actualizarPending: actualizarMutation.pending,
    reactivar: reactivarMutation.mutate,
    reactivarPending: reactivarMutation.pending,
    darDeBaja: bajaMutation.mutate,
    darDeBajaPending: bajaMutation.pending,
    fieldErrors: {
      ...crearCDMutation.fieldErrors,
      ...crearLocalMutation.fieldErrors,
      ...actualizarMutation.fieldErrors,
    },
  };
}
