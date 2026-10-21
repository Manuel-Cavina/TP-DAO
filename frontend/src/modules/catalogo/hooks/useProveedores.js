import { useAsync, useMutation } from "../../../shared/hooks";
import { proveedoresService } from "../services";
import { mapProveedorToUI } from "../mappers/catalogoMappers";

export function useProveedores({ activos = true } = {}) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await proveedoresService.listar({ activos }, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapProveedorToUI);
    },
    [activos]
  );

  const crearMutation = useMutation(
    (dto) => proveedoresService.crear(dto),
    { successMessage: "Proveedor registrado exitosamente", onSuccess: reload }
  );

  const actualizarMutation = useMutation(
    ({ id, dto }) => proveedoresService.actualizar(id, dto),
    { successMessage: "Proveedor actualizado correctamente", onSuccess: reload }
  );

  const bajaMutation = useMutation(
    (id) => proveedoresService.darDeBaja(id),
    { successMessage: "Proveedor dado de baja lógica", onSuccess: reload }
  );

  return {
    proveedores: data || [],
    status,
    loading,
    error,
    reload,
    crear: crearMutation.mutate,
    crearPending: crearMutation.pending,
    crearFieldErrors: crearMutation.fieldErrors,
    actualizar: actualizarMutation.mutate,
    actualizarPending: actualizarMutation.pending,
    actualizarFieldErrors: actualizarMutation.fieldErrors,
    darDeBaja: bajaMutation.mutate,
    darDeBajaPending: bajaMutation.pending,
  };
}
