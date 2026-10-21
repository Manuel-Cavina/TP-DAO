import { useAsync, useMutation } from "../../../shared/hooks";
import { productosService } from "../services";
import { mapProductoToUI } from "../mappers/catalogoMappers";

export function useProductos({ activos = true, categoriaId } = {}) {
  const { data, status, error, reload, loading } = useAsync(
    async ({ signal }) => {
      const resp = await productosService.listar({ activos, categoriaId }, { signal });
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      return items.map(mapProductoToUI);
    },
    [activos, categoriaId]
  );

  const crearMutation = useMutation(
    (dto) => productosService.crear(dto),
    { successMessage: "Producto creado exitosamente", onSuccess: reload }
  );

  const actualizarPrecioMutation = useMutation(
    ({ codigo, precio }) => productosService.actualizarPrecio(codigo, precio),
    { successMessage: "Precio actualizado correctamente", onSuccess: reload }
  );

  const actualizarMasivoMutation = useMutation(
    (actualizaciones) => productosService.actualizacionMasiva(actualizaciones),
    { successMessage: "Actualización masiva completada exitosamente", onSuccess: reload }
  );

  const bajaMutation = useMutation(
    (codigo) => productosService.darDeBaja(codigo),
    { successMessage: "Producto dado de baja lógica", onSuccess: reload }
  );

  return {
    productos: data || [],
    status,
    loading,
    error,
    reload,
    crear: crearMutation.mutate,
    crearPending: crearMutation.pending,
    crearFieldErrors: crearMutation.fieldErrors,
    actualizarPrecio: actualizarPrecioMutation.mutate,
    actualizarPrecioPending: actualizarPrecioMutation.pending,
    actualizarMasivo: actualizarMasivoMutation.mutate,
    actualizarMasivoPending: actualizarMasivoMutation.pending,
    darDeBaja: bajaMutation.mutate,
    darDeBajaPending: bajaMutation.pending,
  };
}
