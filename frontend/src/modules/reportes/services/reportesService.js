import { httpClient } from "../../../core/http/httpClient";
import {
  MOCK_R1_RESPONSE,
  MOCK_R2_RESPONSE,
  MOCK_CATEGORIAS,
  MOCK_UBICACIONES,
} from "./reportesMockData";

export const reportesService = {
  /**
   * R1: Estado Integral de Existencias, Stock Minimo y Valorizacion de Inventario
   */
  async getR1StockValorizacion(params = {}) {
    try {
      const data = await httpClient.get("/api/reportes/r1-stock-valorizacion", { params });
      if (data && data.resumen && Array.isArray(data.items)) {
        return data;
      }
    } catch (err) {
      console.warn("Backend /api/reportes/r1-stock-valorizacion no disponible, usando fallback:", err);
    }

    let filteredItems = [...MOCK_R1_RESPONSE.items];
    if (params.ubicacion_id) {
      filteredItems = filteredItems.filter((i) => i.ubicacion_id === Number(params.ubicacion_id));
    }
    if (params.categoria_id) {
      filteredItems = filteredItems.filter((i) => i.categoria_id === Number(params.categoria_id));
    }
    if (params.solo_bajo_minimo) {
      filteredItems = filteredItems.filter((i) => i.estado_stock === "CRITICO");
    }

    return {
      ...MOCK_R1_RESPONSE,
      items: filteredItems,
    };
  },

  /**
   * R1 Drill-Down: Ficha Multisede por Producto con desglose CD vs Locales
   */
  async getR1DrillDown(productoId) {
    try {
      const data = await httpClient.get(`/api/reportes/r1-stock-valorizacion/${productoId}`);
      if (data && data.producto_id) {
        return data;
      }
    } catch (err) {
      console.warn(`Backend /api/reportes/r1-stock-valorizacion/${productoId} no disponible, usando fallback:`, err);
    }

    const pId = Number(productoId);
    const itemMaster = MOCK_R1_RESPONSE.items.find((i) => i.producto_id === pId) || MOCK_R1_RESPONSE.items[0];
    const desglose = MOCK_R1_RESPONSE.items.filter((i) => i.producto_id === itemMaster.producto_id);

    const totalDisp = desglose.reduce((acc, row) => acc + row.cantidad_disponible, 0);
    const totalTrans = desglose.reduce((acc, row) => acc + row.cantidad_en_transito, 0);
    const totalExist = totalDisp + totalTrans;
    const totalCosto = desglose.reduce((acc, row) => acc + row.valorizacion_costo, 0);
    const totalVenta = desglose.reduce((acc, row) => acc + row.valorizacion_venta, 0);
    const anyCritico = desglose.some((r) => r.estado_stock === "CRITICO");
    const anyAdv = desglose.some((r) => r.estado_stock === "ADVERTENCIA");

    return {
      producto_id: itemMaster.producto_id,
      producto_codigo: itemMaster.producto_codigo,
      producto_nombre: itemMaster.producto_nombre,
      categoria_nombre: itemMaster.categoria_nombre,
      costo_unitario: itemMaster.costo_unitario,
      precio_venta: itemMaster.precio_venta,
      total_disponible_red: totalDisp,
      total_transito_red: totalTrans,
      total_existencias_red: totalExist,
      total_valorizado_costo_red: totalCosto,
      total_valorizado_venta_red: totalVenta,
      estado_global: anyCritico ? "CRITICO" : anyAdv ? "ADVERTENCIA" : "OPTIMO",
      desglose_por_ubicacion: desglose,
      grafico_stock_por_ubicacion: {
        data: [
          {
            name: "Disponible",
            type: "bar",
            x: desglose.map((d) => d.ubicacion_nombre),
            y: desglose.map((d) => d.cantidad_disponible),
            marker: { color: "#2563eb" },
          },
          {
            name: "En Transito",
            type: "bar",
            x: desglose.map((d) => d.ubicacion_nombre),
            y: desglose.map((d) => d.cantidad_en_transito),
            marker: { color: "#f59e0b" },
          },
          {
            name: "Minimo Seguridad",
            type: "bar",
            x: desglose.map((d) => d.ubicacion_nombre),
            y: desglose.map((d) => d.nivel_minimo_existencia),
            marker: { color: "#94a3b8" },
          },
        ],
        layout: {
          title: `Distribucion Fisica de Stock: ${itemMaster.producto_nombre}`,
          barmode: "group",
          template: "plotly_white",
          xaxis: { title: "Nodos de la Red Stocky" },
          yaxis: { title: "Unidades Fisicas" },
          margin: { l: 50, r: 20, t: 40, b: 60 },
        },
      },
    };
  },

  /**
   * R2: Auditoria Forense de Mermas por Precinto Violado y Bultos Rechazados
   */
  async getR2MermasPrecinto(params = {}) {
    try {
      const data = await httpClient.get("/api/reportes/r2-mermas-precinto", { params });
      if (data && data.resumen && Array.isArray(data.bultos_rechazados)) {
        return data;
      }
    } catch (err) {
      console.warn("Backend /api/reportes/r2-mermas-precinto no disponible, usando fallback:", err);
    }

    let filtered = [...MOCK_R2_RESPONSE.bultos_rechazados];
    if (params.local_destino_id) {
      filtered = filtered.filter((b) => b.destino_id === Number(params.local_destino_id));
    }
    return {
      ...MOCK_R2_RESPONSE,
      bultos_rechazados: filtered,
    };
  },

  /**
   * R2 Drill-Down: Auditoria Forense Detallada de Bulto con Historial Inmutable
   */
  async getR2DrillDown(bultoId) {
    try {
      const data = await httpClient.get(`/api/reportes/r2-mermas-precinto/${bultoId}`);
      if (data && data.bulto_id) {
        return data;
      }
    } catch (err) {
      console.warn(`Backend /api/reportes/r2-mermas-precinto/${bultoId} no disponible, usando fallback:`, err);
    }

    const bId = Number(bultoId);
    const bulto = MOCK_R2_RESPONSE.bultos_rechazados.find((b) => b.bulto_id === bId) || MOCK_R2_RESPONSE.bultos_rechazados[0];

    return {
      bulto_id: bulto.bulto_id,
      orden_id: bulto.orden_id,
      remito_numero: bulto.remito_numero,
      codigo_precinto: bulto.codigo_precinto,
      precinto_intacto: bulto.precinto_intacto,
      origen: {
        id: bulto.origen_id,
        nombre: bulto.origen_nombre,
        tipo: "CD",
        direccion: "Parque Industrial Norte - Nave 4, Troncal Logistica",
        telefono: "+54 11 5555-0100",
      },
      destino: {
        id: bulto.destino_id,
        nombre: bulto.destino_nombre,
        tipo: "LOCAL",
        direccion: "Av. Cabildo 2450, CABA",
        telefono: "+54 11 4781-9900",
      },
      estado_actual: "RECHAZADO",
      fecha_rechazo: bulto.fecha_rechazo,
      motivo_rechazo: bulto.motivo_rechazo,
      total_unidades_merma: bulto.total_unidades,
      costo_total_merma: bulto.total_perdida_costo,
      valor_venta_merma: bulto.total_perdida_venta,
      detalles_productos: bulto.detalles_productos,
      linea_de_tiempo: [
        {
          id: 1,
          estado_anterior: "INICIAL",
          estado_nuevo: "PREPARADO",
          fecha_hora: "2026-10-18T09:15:00",
          observacion: "Picking completado y consolidacion en nave central CD.",
        },
        {
          id: 2,
          estado_anterior: "PREPARADO",
          estado_nuevo: "PRECINTADO",
          fecha_hora: "2026-10-18T10:30:00",
          observacion: `Colocacion de precinto de seguridad ${bulto.codigo_precinto} y faja inviolable con registro de codigo de barra.`,
        },
        {
          id: 3,
          estado_anterior: "PRECINTADO",
          estado_nuevo: "EN_TRANSITO",
          fecha_hora: "2026-10-18T12:00:00",
          observacion: "Carga en flete logistico troncal y emision del Remito oficial.",
        },
        {
          id: 4,
          estado_anterior: "EN_TRANSITO",
          estado_nuevo: "RECIBIDO",
          fecha_hora: "2026-10-18T16:15:00",
          observacion: "Arribo al muelle de descarga del local de destino para verificacion fisica obligatoria (P6).",
        },
        {
          id: 5,
          estado_anterior: "RECIBIDO",
          estado_nuevo: "RECHAZADO",
          fecha_hora: bulto.fecha_rechazo,
          observacion: `Rechazo inapelable (V1): ${bulto.motivo_rechazo}. Mercaderia desviada a peritaje patrimonial sin ingreso al stock comercial.`,
        },
      ],
      dictamen_forense: `DICTAMEN PERICIAL FORENSE Nº ${bulto.bulto_id}-2026:\nEl precinto de seguridad ${bulto.codigo_precinto} presenta rotura mecanica por cizalla y la faja holografica de garantia ha sido desprendida con signos de reposicion adulterada. En concordancia con el protocolo de seguridad de Stocky y la Regla V1, la carga completa ha sido catalogada como MERMA LOGISTICA PATRIMONIAL. No se autoriza su incorporacion al inventario vendible del local comercial.`,
      grafico_perdida_por_producto: {
        data: [
          {
            type: "bar",
            x: bulto.detalles_productos.map((p) => p.producto_codigo),
            y: bulto.detalles_productos.map((p) => p.perdida_costo),
            name: "Perdida Costo ($)",
            marker: { color: "#b91c1c" },
          },
          {
            type: "bar",
            x: bulto.detalles_productos.map((p) => p.producto_codigo),
            y: bulto.detalles_productos.map((p) => p.perdida_venta),
            name: "Perdida Venta ($)",
            marker: { color: "#f97316" },
          },
        ],
        layout: {
          title: "Valorizacion de Mercaderia Damnificada por SKU",
          barmode: "group",
          template: "plotly_white",
          xaxis: { title: "Codigo de Producto (SKU)" },
          yaxis: { title: "Perdida ($)" },
          margin: { l: 50, r: 20, t: 40, b: 40 },
        },
      },
    };
  },

  /**
   * Helper: Ubicaciones para filtros
   */
  async getUbicaciones() {
    try {
      const data = await httpClient.get("/api/stock/ubicaciones", { params: { activas: true } });
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {
      // fallback
    }
    return MOCK_UBICACIONES;
  },

  /**
   * Helper: Categorias para filtros
   */
  async getCategorias() {
    try {
      const data = await httpClient.get("/api/catalogo/categorias");
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {
      // fallback
    }
    return MOCK_CATEGORIAS;
  },
};
