import { http } from "../../../core/http";

const BASE = "/api/stock";

export const stockService = {
  ingresoCD: (dto) => {
    const payload = {
      producto_id: Number(dto.producto_id ?? dto.productoId),
      cd_id: Number(dto.cd_id ?? dto.cdId),
      cantidad: Number(dto.cantidad),
    };
    return http.post(`${BASE}/ingresos`, payload);
  },
  consultarDisponible: ({ productoId, ubicacionId }, options) =>
    http.get(`${BASE}/${encodeURIComponent(productoId)}/${encodeURIComponent(ubicacionId)}`, options),
  consultarPorUbicacion: (ubicacionId, options) =>
    http.get(`${BASE}`, { ...options, params: { ubicacion_id: ubicacionId } }),
  consultarPorProducto: (productoId, options) =>
    http.get(`${BASE}`, { ...options, params: { producto_id: productoId } }),
  listarStock: (params = {}, options) =>
    http.get(`${BASE}`, { ...options, params }),
  listarAlertas: ({ soloNoLeidas = false, ubicacionId } = {}, options) => {
    const params = {};
    if (soloNoLeidas) params.leida = false;
    if (ubicacionId) params.ubicacion_id = ubicacionId;
    return http.get(`${BASE}/alertas`, { ...options, params });
  },
  marcarAlertaLeida: (alertaId, options) =>
    http.post(`${BASE}/alertas/${encodeURIComponent(alertaId)}/leer`, {}, options),
};

export default stockService;
