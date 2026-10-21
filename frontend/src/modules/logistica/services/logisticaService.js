import { http } from "../../../core/http";

const BASE = "/api/logistica";

export const logisticaService = {
  // Necesidades (P3)
  listarNecesidades: ({ localId } = {}, options) =>
    http.get(`${BASE}/necesidades`, { ...options, params: { local_id: localId } }),
  registrarNecesidad: (dto) => http.post(`${BASE}/necesidades`, dto),

  // Ordenes (P3)
  consolidarOrden: ({ localDestinoId, origenId, necesidadIds }) =>
    http.post(`${BASE}/ordenes/consolidar`, {
      local_destino_id: localDestinoId,
      origen_id: origenId,
      necesidad_ids: necesidadIds,
    }),
  crearOrdenManual: (dto) => http.post(`${BASE}/ordenes`, dto),
  listarOrdenes: ({ estado } = {}, options) =>
    http.get(`${BASE}/ordenes`, { ...options, params: { estado } }),
  obtenerOrden: (id, options) => http.get(`${BASE}/ordenes/${encodeURIComponent(id)}`, options),
  listarBultosPorOrden: (ordenId, options) =>
    http.get(`${BASE}/ordenes/${encodeURIComponent(ordenId)}/bultos`, options),

  // Bultos y Precintos (P4)
  registrarPrecinto: (codigo) => http.post(`${BASE}/precintos`, { codigo }),
  crearBulto: (ordenId, items) => http.post(`${BASE}/ordenes/${encodeURIComponent(ordenId)}/bultos`, { items }),
  precintarBulto: (bultoId, codigoPrecinto) =>
    http.post(`${BASE}/bultos/${encodeURIComponent(bultoId)}/precintar`, { codigo_precinto: codigoPrecinto }),
  obtenerBulto: (bultoId, options) =>
    http.get(`${BASE}/bultos/${encodeURIComponent(bultoId)}`, options),

  // Remitos, Despacho y Cierre (P5, P6, V1)
  generarRemito: (ordenId, { numero, bultosIds }) =>
    http.post(`${BASE}/remitos`, { numero, bultos_ids: bultosIds }, { params: { orden_id: ordenId } }),
  listarRemitos: (options) => http.get(`${BASE}/remitos`, options),
  obtenerRemito: (numero, options) =>
    http.get(`${BASE}/remitos/${encodeURIComponent(numero)}`, options),
  despacharRemito: (numero) => http.post(`${BASE}/remitos/${encodeURIComponent(numero)}/despachar`),
  recibirRemito: (numero) => http.post(`${BASE}/remitos/${encodeURIComponent(numero)}/recibir`),
  verificarBulto: (bultoId, { codigoPrecintoRecibido, estaIntacto }) =>
    http.post(`${BASE}/bultos/${encodeURIComponent(bultoId)}/verificar`, {
      codigo_precinto_recibido: codigoPrecintoRecibido,
      esta_intacto: estaIntacto,
    }),
  cerrarRemito: (numero) => http.post(`${BASE}/remitos/${encodeURIComponent(numero)}/cerrar`),

  // Trazabilidad (V2)
  consultarTrazabilidad: (bultoId, options) =>
    http.get(`${BASE}/bultos/${encodeURIComponent(bultoId)}/trazabilidad`, options),
};
