import { http } from "../../../core/http";

const BASE = "/api/stock";

export const stockService = {
  ingresoCD: (dto) => http.post(`${BASE}/ingreso-cd`, dto),
  consultarDisponible: ({ productoId, ubicacionId }, options) =>
    http.get(`${BASE}/disponible`, { ...options, params: { producto_id: productoId, ubicacion_id: ubicacionId } }),
  consultarPorUbicacion: (ubicacionId, options) =>
    http.get(`${BASE}/ubicacion/${encodeURIComponent(ubicacionId)}`, options),
  consultarPorProducto: (productoId, options) =>
    http.get(`${BASE}/producto/${encodeURIComponent(productoId)}`, options),
  listarAlertas: ({ soloNoLeidas = false, ubicacionId } = {}, options) =>
    http.get(`${BASE}/alertas`, { ...options, params: { solo_no_leidas: soloNoLeidas, ubicacion_id: ubicacionId } }),
  marcarAlertaLeida: (alertaId, options) =>
    http.patch(`${BASE}/alertas/${encodeURIComponent(alertaId)}/leida`, {}, options),
};

