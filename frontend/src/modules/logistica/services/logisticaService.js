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
  precintarBultosLote: (ordenId, asignaciones) =>
    http.post(`${BASE}/ordenes/${encodeURIComponent(ordenId)}/bultos/precintar`, {
      items: asignaciones.map(({ bultoId, codigoPrecinto }) => ({
        bulto_id: bultoId,
        codigo_precinto: codigoPrecinto,
      })),
    }),
  precintarLoteRevisado: async (ordenId, asignaciones) => {
    // Seal registration is reusable; package assignments share one atomic request.
    for (const { codigoPrecinto } of asignaciones) {
      try {
        await logisticaService.registrarPrecinto(codigoPrecinto);
      } catch (error) {
        if (error?.status !== 409) throw error;
      }
    }
    return logisticaService.precintarBultosLote(ordenId, asignaciones);
  },
  obtenerBulto: (bultoId, options) =>
    http.get(`${BASE}/bultos/${encodeURIComponent(bultoId)}`, options),

  // Aprobacion de Bultos (US4 / FR-041)
  aprobarBulto: (bultoId) =>
    http.post(`${BASE}/bultos/${encodeURIComponent(bultoId)}/aprobar`, {}),
  aprobarBultosLote: (ordenId) =>
    http.post(`${BASE}/ordenes/${encodeURIComponent(ordenId)}/bultos/aprobar-elegibles`, {}),

  // Remitos, Despacho y Cierre (P5, P6, V1)
  generarRemito: (ordenId, { bultosIds }) =>
    http.post(`${BASE}/remitos`, { bultos_ids: bultosIds }, { params: { orden_id: ordenId } }),
  listarRemitos: (options) => http.get(`${BASE}/remitos`, options),
  obtenerRemito: (numero, options) =>
    http.get(`${BASE}/remitos/${encodeURIComponent(numero)}`, options),
  despacharRemito: (numero) => http.post(`${BASE}/remitos/${encodeURIComponent(numero)}/despachar`),
  recibirRemito: (numero) => http.post(`${BASE}/remitos/${encodeURIComponent(numero)}/recibir`),
  verificarBulto: (bultoId, { codigoPrecintoRecibido, estaIntacto, motivoRechazo, motivo_rechazo }) =>
    http.post(`${BASE}/bultos/${encodeURIComponent(bultoId)}/verificar`, {
      codigo_precinto_recibido: codigoPrecintoRecibido,
      esta_intacto: estaIntacto,
      motivo_rechazo: motivoRechazo || motivo_rechazo || "",
      motivo: motivoRechazo || motivo_rechazo || "",
    }),
  controlarBultosBatch: (remitoNumero, payload) =>
    http.post(`${BASE}/remitos/${encodeURIComponent(remitoNumero)}/controlar-bultos`, payload),
  cerrarRemito: (numero) => http.post(`${BASE}/remitos/${encodeURIComponent(numero)}/cerrar`),

  // Trazabilidad (V2)
  consultarTrazabilidad: (bultoId, options) =>
    http.get(`${BASE}/bultos/${encodeURIComponent(bultoId)}/trazabilidad`, options),
  consultarTrazabilidadOrden: (ordenId, options) =>
    http.get(`${BASE}/ordenes/${encodeURIComponent(ordenId)}/trazabilidad`, options),
  obtenerTrazabilidadRemito: (remitoNumero, options) =>
    http.get(`${BASE}/trazabilidad/remitos/${encodeURIComponent(remitoNumero)}`, options),
  buscarTrazabilidad: (termino, options) =>
    http.get(`${BASE}/trazabilidad/buscar`, { ...options, params: { termino } }),
  listarEventosRecientes: ({ limite = 12 } = {}, options) =>
    http.get(`${BASE}/trazabilidad/recientes`, { ...options, params: { limite } }),
};
