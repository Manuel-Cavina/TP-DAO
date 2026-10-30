import { httpClient } from "../../../core/http/httpClient.js";

/**
 * Reportes 1, 2 y 5 de la consigna. El backend devuelve { filas, totales, grafico }
 * (Reporte_DTO); la figura Plotly se dibuja tal cual con PlotlyRenderer.
 */
function asReporte(data) {
  if (!data || !Array.isArray(data.filas)) {
    throw new Error("El backend devolvió un reporte con formato inesperado.");
  }
  return { filas: data.filas, totales: data.totales || {}, grafico: data.grafico || null };
}

export const reportesAnaliticosService = {
  ventas: async ({ desde, hasta, localId }) =>
    asReporte(await httpClient.get("/api/reportes/ventas", { params: { desde, hasta, local_id: localId } })),
  productosMasVendidos: async ({ desde, hasta, top }) =>
    asReporte(await httpClient.get("/api/reportes/productos-mas-vendidos", { params: { desde, hasta, top } })),
  tiemposTransito: async ({ desde, hasta }) =>
    asReporte(await httpClient.get("/api/reportes/tiempos-transito", { params: { desde, hasta } })),
  locales: async () => {
    const data = await httpClient.get("/api/ubicaciones", { params: { solo_activas: true } });
    return (Array.isArray(data) ? data : []).filter((u) => u.tipo === "LOCAL");
  },
};

export default reportesAnaliticosService;
