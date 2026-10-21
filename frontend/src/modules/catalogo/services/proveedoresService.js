import { http } from "../../../core/http";

const BASE = "/api/catalogo/proveedores";

/** Contrato: GET/POST /proveedores, GET/PUT/DELETE /proveedores/{id}. */
export const proveedoresService = {
  listar: ({ activos = false } = {}, options) =>
    http.get(BASE, { ...options, params: { solo_activos: activos, activos } }),
  obtener: (id, options) => http.get(`${BASE}/${encodeURIComponent(id)}`, options),
  crear: (dto) => http.post(BASE, dto),
  actualizar: (id, dto) => http.put(`${BASE}/${encodeURIComponent(id)}`, dto),
  darDeBaja: (id) => http.del(`${BASE}/${encodeURIComponent(id)}`),
};
