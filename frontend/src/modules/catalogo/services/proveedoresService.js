import { http } from "../../../core/http";

const BASE = "/api/catalogo/proveedores";

/** Contrato: GET/POST /proveedores, GET/PUT/DELETE /proveedores/{cuit}. */
export const proveedoresService = {
  listar: ({ activos = true } = {}, options) => http.get(BASE, { ...options, params: { activos } }),
  obtener: (cuit, options) => http.get(`${BASE}/${encodeURIComponent(cuit)}`, options),
  crear: (dto) => http.post(BASE, dto),
  actualizar: (cuit, dto) => http.put(`${BASE}/${encodeURIComponent(cuit)}`, dto),
  darDeBaja: (cuit) => http.del(`${BASE}/${encodeURIComponent(cuit)}`),
};
