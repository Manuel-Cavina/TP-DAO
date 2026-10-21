import { http } from "../../../core/http";

const BASE = "/api/catalogo/productos";

/** Contrato: GET/POST /productos, GET/DELETE /productos/{id}, PATCH /productos/{id}/precio, POST /productos/actualizacion-masiva */
export const productosService = {
  listar: ({ activos = true, categoriaId } = {}, options) =>
    http.get(BASE, { ...options, params: { solo_activos: activos, activos, categoria_id: categoriaId } }),
  obtener: (idOrCodigo, options) => http.get(`${BASE}/${encodeURIComponent(idOrCodigo)}`, options),
  crear: (dto) => http.post(BASE, dto),
  actualizarPrecio: (idOrCodigo, precioVenta) =>
    http.patch(`${BASE}/${encodeURIComponent(idOrCodigo)}/precio`, { precio_venta: precioVenta }),
  actualizacionMasiva: (actualizaciones) =>
    http.post(
      `${BASE}/actualizacion-masiva`,
      Array.isArray(actualizaciones) ? { actualizaciones } : actualizaciones
    ),
  darDeBaja: (idOrCodigo) => http.del(`${BASE}/${encodeURIComponent(idOrCodigo)}`),
};
