import { http } from "../../../core/http";

const BASE = "/api/ubicaciones";

export const ubicacionesService = {
  listar: ({ activas = false } = {}, options) =>
    http.get(BASE, { ...options, params: { solo_activas: activas, activas } }),
  obtener: (id, options) => http.get(`${BASE}/${encodeURIComponent(id)}`, options),
  crearCD: (dto) => http.post(`${BASE}/centros-distribucion`, dto),
  crearLocal: (dto) => http.post(`${BASE}/locales`, dto),
  actualizar: (id, dto) => http.put(`${BASE}/${encodeURIComponent(id)}`, dto),
  darDeBaja: (id) => http.del(`${BASE}/${encodeURIComponent(id)}`),
  reactivar: (id) => http.post(`${BASE}/${encodeURIComponent(id)}/reactivar`, {}),
};
