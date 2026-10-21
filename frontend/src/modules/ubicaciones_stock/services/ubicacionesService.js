import { http } from "../../../core/http";

const BASE = "/api/stock/ubicaciones";

export const ubicacionesService = {
  listar: ({ activas = true } = {}, options) =>
    http.get(BASE, { ...options, params: { activas } }),
  obtener: (id, options) => http.get(`${BASE}/${encodeURIComponent(id)}`, options),
  crearCD: (dto) => http.post(`${BASE}/cd`, dto),
  crearLocal: (dto) => http.post(`${BASE}/locales`, dto),
  actualizar: (id, dto) => http.put(`${BASE}/${encodeURIComponent(id)}`, dto),
  darDeBaja: (id) => http.del(`${BASE}/${encodeURIComponent(id)}`),
  reactivar: (id) => http.patch(`${BASE}/${encodeURIComponent(id)}/activar`),
};
