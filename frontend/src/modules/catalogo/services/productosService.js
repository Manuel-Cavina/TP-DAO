import { http } from "../../../core/http";

const BASE = "/api/catalogo/productos";

/** Contrato: GET/POST /productos, GET/DELETE /productos/{codigo}, PATCH /productos/{codigo}/precio, POST /productos/actualizacion-masiva */
export const productosService = {
  listar: ({ activos = true, categoriaId } = {}, options) =>
    http.get(BASE, { ...options, params: { activos, categoria_id: categoriaId } }),
  obtener: (codigo, options) => http.get(`${BASE}/${encodeURIComponent(codigo)}`, options),
  crear: (dto) => http.post(BASE, dto),
  actualizarPrecio: (codigo, precioVenta) =>
    http.patch(`${BASE}/${encodeURIComponent(codigo)}/precio`, { precio_venta: precioVenta }),
  actualizacionMasiva: (actualizaciones) =>
    http.post(`${BASE}/actualizacion-masiva`, { actualizaciones }),
  darDeBaja: (codigo) => http.del(`${BASE}/${encodeURIComponent(codigo)}`),
};
