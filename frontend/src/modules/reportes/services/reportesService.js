import { httpClient } from "../../../core/http/httpClient.js";

const number = (value) => Number(value || 0);

async function loadStockReport(params = {}) {
  const [report, products, locations, categories] = await Promise.all([
    httpClient.get("/api/reportes/existencias", { params: { ubicacion_id: params.ubicacion_id } }),
    httpClient.get("/api/catalogo/productos"),
    httpClient.get("/api/ubicaciones", { params: { solo_activas: true } }),
    httpClient.get("/api/catalogo/categorias"),
  ]);
  if (!Array.isArray(report?.filas) || !Array.isArray(products) || !Array.isArray(locations) || !Array.isArray(categories)) {
    throw new Error("Respuesta inválida del reporte de existencias.");
  }
  const productById = new Map(products.map((product) => [product.id, product]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const items = report.filas.map((row) => {
    const product = productById.get(row.producto_id);
    const location = locationById.get(row.ubicacion_id);
    const minimum = number(row.nivel_minimo_existencia);
    const available = number(row.cantidad_disponible);
    const critical = Boolean(row.en_o_bajo_minimo);
    return {
      ...row,
      producto_codigo: row.codigo,
      producto_nombre: row.nombre,
      categoria_nombre: categoryById.get(product?.categoria_id)?.nombre || null,
      categoria_id: product?.categoria_id,
      ubicacion_tipo: location?.tipo || null,
      estado_stock: critical ? (available === 0 ? "CRITICO" : "ADVERTENCIA") : "NORMAL",
      valorizacion_costo: number(row.valorizacion),
      valorizacion_venta: available * number(product?.precio_venta),
      total_existencias: available + number(row.cantidad_en_transito),
      costo_unitario: product?.costo_unitario == null ? null : number(product.costo_unitario),
      precio_venta: product?.precio_venta == null ? null : number(product.precio_venta),
      margen_potencial: available * number(product?.precio_venta) - number(row.valorizacion),
      producto: product,
    };
  }).filter((item) => !params.categoria_id || item.producto?.categoria_id === params.categoria_id)
    .filter((item) => !params.solo_bajo_minimo || item.estado_stock !== "NORMAL");
  const totalCost = items.reduce((sum, item) => sum + item.valorizacion_costo, 0);
  const totalSale = items.reduce((sum, item) => sum + item.valorizacion_venta, 0);
  return {
    items,
    resumen: {
      total_valorizado_costo: totalCost,
      total_valorizado_venta: totalSale,
      margen_total_potencial: totalSale - totalCost,
      total_registros: items.length,
      total_existencias: items.reduce((sum, item) => sum + item.total_existencias, 0),
      total_unidades_disponibles: items.reduce((sum, item) => sum + number(item.cantidad_disponible), 0),
      total_unidades_en_transito: items.reduce((sum, item) => sum + number(item.cantidad_en_transito), 0),
      total_items_criticos: items.filter((item) => item.estado_stock !== "NORMAL").length,
    },
    grafico_valorizacion_por_ubicacion: {
      data: [{ type: "bar", x: [...new Set(items.map((item) => item.ubicacion_nombre))], y: [...new Set(items.map((item) => item.ubicacion_nombre))].map((name) => items.filter((item) => item.ubicacion_nombre === name).reduce((sum, item) => sum + item.valorizacion_costo, 0)), name: "Valorización a costo" }],
      layout: { title: { text: "Valorización del inventario filtrado por ubicación" } },
    },
    grafico_distribucion_stock: null,
  };
}

export const reportesService = {
  getR1StockValorizacion: loadStockReport,

  async getR1DrillDown(productoId) {
    const report = await loadStockReport();
    const desglose_por_ubicacion = report.items.filter((item) => item.producto_id === productoId).map((item) => ({
      ...item,
      total_existencias: number(item.cantidad_disponible) + number(item.cantidad_en_transito),
      faltante: Math.max(0, number(item.nivel_minimo_existencia) - number(item.cantidad_disponible)),
    }));
    const product = desglose_por_ubicacion[0]?.producto;
    if (!product) throw new Error("Producto sin existencias en el reporte.");
    const total = desglose_por_ubicacion.reduce((sum, item) => sum + number(item.cantidad_disponible), 0);
    return {
      producto_id: productoId, producto_codigo: product.codigo, producto_nombre: product.nombre,
      categoria_nombre: desglose_por_ubicacion[0]?.categoria_nombre, costo_unitario: number(product.costo_unitario), precio_venta: number(product.precio_venta),
      total_disponible_red: total, total_transito_red: desglose_por_ubicacion.reduce((sum, item) => sum + number(item.cantidad_en_transito), 0),
      total_valorizado_costo_red: desglose_por_ubicacion.reduce((sum, item) => sum + item.valorizacion_costo, 0),
      total_valorizado_venta_red: total * number(product.precio_venta), desglose_por_ubicacion,
    };
  },

  async getR2MermasPrecinto(params = {}) {
    const today = new Date().toISOString().slice(0, 10);
    if (params.fecha_inicio && params.fecha_fin && params.fecha_inicio > params.fecha_fin) throw new Error("La fecha inicial no puede ser posterior a la fecha final.");
    const data = await httpClient.get("/api/reportes/mermas", { params: {
      desde: params.fecha_inicio || "2000-01-01", hasta: params.fecha_fin || today, local_id: params.local_destino_id,
    } });
    if (!Array.isArray(data?.filas)) throw new Error("Respuesta inválida del reporte de mermas.");
    const bultos_rechazados = data.filas.map((row) => ({
      ...row, destino_nombre: row.local_nombre, total_unidades: number(row.unidades_perdidas),
      total_perdida_costo: number(row.valor_perdido), total_perdida_venta: null, precinto_intacto: null,
      codigo_precinto: row.codigo_precinto ?? null, origen_nombre: row.origen_nombre ?? null,
    }));
    return { bultos_rechazados, resumen: {
      total_bultos_rechazados: number(data.totales?.bultos_rechazados), total_unidades_perdidas: number(data.totales?.unidades_perdidas),
      total_costo_merma: number(data.totales?.valor_perdido), total_valor_venta_merma: null,
      tasa_rechazo_porcentaje: null, local_mas_afectado: null,
    }, grafico_mermas_por_local: data.grafico, grafico_motivos_rechazo: null };
  },

  async getR2DrillDown(bultoId, reportRow = null) {
    const data = await httpClient.get(`/api/logistica/bultos/${encodeURIComponent(bultoId)}/trazabilidad`);
    if (!Array.isArray(data?.eventos)) throw new Error("Respuesta inválida de trazabilidad del bulto.");
    return {
      ...data,
      linea_de_tiempo: data.eventos.map((event, index) => ({ ...event, id: event.id ?? `${bultoId}-${index}` })),
      total_unidades_merma: reportRow?.total_unidades ?? null,
      costo_total_merma: reportRow?.total_perdida_costo ?? null,
      valor_venta_merma: reportRow?.total_perdida_venta ?? null,
      remito_numero: reportRow?.remito_numero ?? null,
      destino: { nombre: reportRow?.destino_nombre ?? "No informado" },
      origen: { nombre: reportRow?.origen_nombre ?? "No informado" },
      motivo_rechazo: data.eventos.findLast((event) => event.estado_nuevo === "RECHAZADO")?.observacion || "Sin observación informada",
      detalles_productos: [],
    };
  },

  async getUbicaciones() {
    const data = await httpClient.get("/api/ubicaciones", { params: { solo_activas: true } });
    if (!Array.isArray(data)) throw new Error("Respuesta inválida de ubicaciones.");
    return data;
  },

  async getCategorias() {
    const data = await httpClient.get("/api/catalogo/categorias");
    if (!Array.isArray(data)) throw new Error("Respuesta inválida de categorías.");
    return data;
  },
};
