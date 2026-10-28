import { useAsync, useMutation } from "../../../shared/hooks";
import { categoriasService } from "../services";
import { mapCategoriaToUI } from "../mappers/catalogoMappers";

export function useCategorias() {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await categoriasService.listar({ signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapCategoriaToUI);
    },
    []
  );

  const crearMutation = useMutation(
    (dto) => categoriasService.crear(dto),
    { successMessage: "Categoría creada exitosamente", onSuccess: reload }
  );

  const actualizarMutation = useMutation(
    ({ id, dto }) => categoriasService.actualizar(id, dto),
    { successMessage: "Categoría actualizada correctamente", onSuccess: reload }
  );

  const bajaMutation = useMutation(
    (id) => categoriasService.darDeBaja(id),
    { successMessage: "Categoría dada de baja lógica", onSuccess: reload }
  );

  return {
    categorias: data || [],
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
