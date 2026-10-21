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

  return {
    categorias: data || [],
    status,
    loading,
    error,
    reload,
    crear: crearMutation.mutate,
    crearPending: crearMutation.pending,
    crearFieldErrors: crearMutation.fieldErrors,
  };
}
