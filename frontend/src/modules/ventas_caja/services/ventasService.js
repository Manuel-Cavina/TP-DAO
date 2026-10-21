import { http } from "../../../core/http";
import {
  mapCajaToUI,
  mapCheckoutToDTO,
  mapComprobanteToUI,
  mapDevolucionToDTO,
  mapDevolucionToUI,
  mapVentaToUI,
} from "../mappers/ventasMappers";

const VENTAS_BASE = "/api/ventas";

export const ventasService = {
  listarVentas: async ({ localId, desde, hasta } = {}, options) => {
    const response = await http.get(VENTAS_BASE, {
      ...options,
      params: { local_id: localId, desde, hasta },
    });
    return (Array.isArray(response) ? response : []).map(mapVentaToUI);
  },

  listarDevoluciones: async ({ ventas = [] } = {}, options) => {
    const groups = await Promise.all(
      ventas.map(async (venta) => {
        const response = await http.get(
          `${VENTAS_BASE}/${venta.id}/devoluciones`,
          options
        );
        return (Array.isArray(response) ? response : []).map((dto) =>
          mapDevolucionToUI(dto, venta)
        );
      })
    );
    return groups.flat();
  },

  obtenerComprobante: async (ventaId, options) => {
    const response = await http.get(
      `${VENTAS_BASE}/${encodeURIComponent(ventaId)}/comprobante`,
      options
    );
    return mapComprobanteToUI(response);
  },

  consultarCaja: async ({ localId, desde, hasta }, options) => {
    const response = await http.get(`/api/caja/${encodeURIComponent(localId)}`, {
      ...options,
      params: { desde, hasta },
    });
    return mapCajaToUI(response);
  },

  procesarVenta: async (form) => {
    const venta = await http.post(VENTAS_BASE, mapCheckoutToDTO(form));
    try {
      return await ventasService.obtenerComprobante(venta.id);
    } catch {
      // La venta ya fue confirmada: un fallo de lectura no debe habilitar un cobro duplicado.
      return mapVentaToUI(venta);
    }
  },

  registrarDevolucion: async (form) => {
    const { ventaId, payload } = mapDevolucionToDTO(form);
    const response = await http.post(
      `${VENTAS_BASE}/${encodeURIComponent(ventaId)}/devoluciones`,
      payload
    );
    return mapDevolucionToUI(response, { id: ventaId, numero: form.facturaNumero });
  },
};
