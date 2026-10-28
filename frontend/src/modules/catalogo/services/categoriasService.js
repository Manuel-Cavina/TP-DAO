import { http } from "../../../core/http";

const BASE = "/api/catalogo/categorias";

/** Contrato: GET/POST /categorias, GET/PUT/DELETE /categorias/{id}. */
export const categoriasService = {
  listar: (options) => http.get(BASE, options),
  obtener: (id, options) => http.get(`${BASE}/${encodeURIComponent(id)}`, options),
  crear: (dto) => http.post(BASE, dto),
  actualizar: (id, dto) => http.put(`${BASE}/${encodeURIComponent(id)}`, dto),
  darDeBaja: (id) => http.del(`${BASE}/${encodeURIComponent(id)}`),
};
