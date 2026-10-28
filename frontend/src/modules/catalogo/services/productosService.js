import { http } from "../../../core/http";

const BASE = "/api/catalogo/productos";

/** Contrato: GET/POST /productos, PUT/DELETE /productos/{id}, POST /productos/actualizacion-masiva */
export const productosService = {
  listar: ({ activos = true, categoriaId } = {}, options) =>
    http.get(BASE, { ...options, params: { solo_activos: activos, activos, categoria_id: categoriaId } }),
  obtener: (idOrCodigo, options) => http.get(`${BASE}/${encodeURIComponent(idOrCodigo)}`, options),
  crear: (dto) => http.post(BASE, dto),
  actualizar: (id, dto) => http.put(`${BASE}/${encodeURIComponent(id)}`, dto),
  actualizacionMasiva: (actualizaciones) =>
    http.post(
      `${BASE}/actualizacion-masiva`,
      Array.isArray(actualizaciones) ? { actualizaciones } : actualizaciones
    ),
  darDeBaja: (idOrCodigo) => http.del(`${BASE}/${encodeURIComponent(idOrCodigo)}`),
};
