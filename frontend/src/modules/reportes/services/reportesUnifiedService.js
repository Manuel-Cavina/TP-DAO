import { httpClient } from "../../../core/http/httpClient.js";
import { reportesService } from "./reportesService.js";
import { reportesAnaliticosService } from "./reportesAnaliticosService.js";

const toIsoDate = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const presets = {
  hace30Dias: () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toIsoDate(d);
  },
  hace7Dias: () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toIsoDate(d);
  },
  inicioMes: () => {
    const d = new Date();
    d.setDate(1);
    return toIsoDate(d);
  },
  inicioAnio: () => {
    const d = new Date();
    d.setMonth(0, 1);
    return toIsoDate(d);
  },
  hoy: () => toIsoDate(new Date()),
};

export const money = (v) =>
  Number(v || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export const num = (v, dec = 0) =>
  Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const reportesUnifiedService = {
  async getLocations() {
    const res = await httpClient.get("/api/ubicaciones", { params: { solo_activas: true } });
    return Array.isArray(res) ? res : [];
  },

  async getCategories() {
    const res = await httpClient.get("/api/catalogo/categorias");
    return Array.isArray(res) ? res : [];
  },

  async getVentas({ desde, hasta, localId }) {
    const data = await reportesAnaliticosService.ventas({ desde, hasta, localId });
    const filas = data.filas || [];
    const totalNeto = Number(data.totales?.total_neto || 0);
    const totalBruto = Number(data.totales?.total_bruto || 0);
    const totalDevoluciones = Number(data.totales?.total_devoluciones || 0);
    const cantVentas = Number(data.totales?.cantidad_ventas || 0);
    const cantDevoluciones = filas.reduce((acc, f) => acc + Number(f.cantidad_devoluciones || 0), 0);
    const tasaDevolucion = totalBruto > 0 ? (totalDevoluciones / totalBruto) * 100 : 0;
    const ticketPromedio = cantVentas > 0 ? totalNeto / cantVentas : 0;

    // Métricas por medio de pago
    const porMedio = {};
    filas.forEach((f) => {
      const m = String(f.medio_pago || "OTRO").toUpperCase();
      if (!porMedio[m]) porMedio[m] = { neto: 0, bruto: 0, devol: 0, ventas: 0 };
      porMedio[m].neto += Number(f.total_neto || 0);
      porMedio[m].bruto += Number(f.total_bruto || 0);
      porMedio[m].devol += Number(f.total_devoluciones || 0);
      porMedio[m].ventas += Number(f.cantidad_ventas || 0);
    });

    // Gráfico complementario de participación por medio de pago
    const mediosLabels = Object.keys(porMedio);
    const graficoComplementario = mediosLabels.length > 0 ? {
      data: [{
        type: "bar",
        x: mediosLabels.map((m) => m === "EFECTIVO" ? "Efectivo" : m === "TARJETA" ? "Tarjeta" : m === "TRANSFERENCIA" ? "Transferencia" : m),
        y: mediosLabels.map((m) => porMedio[m].neto),
        marker: { color: ["#16a34a", "#2563eb", "#0891b2"] },
        hovertemplate: "%{x}: $ %{y:,.2f}<extra></extra>",
      }],
      layout: {
        title: "Distribución de recaudación neta por canal de pago",
        xaxis: { title: "Medio de cobro" },
        yaxis: { title: "Total neto ($)" },
      },
    } : null;

    return {
      filas,
      totales: data.totales,
      grafico: data.grafico,
      graficoComplementario,
      kpis: [
        { label: "Total neto facturado", value: money(totalNeto), context: "Ingresos netos de devoluciones", badgeTone: "success", badgeText: "Neto comercio" },
        { label: "Facturación bruta", value: money(totalBruto), context: `${num(cantVentas)} operaciones registradas`, badgeTone: "neutral", badgeText: "Bruto" },
        { label: "Devoluciones comerciales", value: money(totalDevoluciones), context: `${num(cantDevoluciones)} reintegros procesados`, badgeTone: totalDevoluciones > 0 ? "danger" : "neutral", badgeText: "Reintegros" },
        { label: "Tasa de devolución", value: `${num(tasaDevolucion, 1)} %`, context: "Impacto sobre facturación bruta", badgeTone: tasaDevolucion > 5 ? "warning" : "success", badgeText: "Ratio merma" },
        { label: "Ticket promedio neto", value: money(ticketPromedio), context: "Monto neto por transacción", badgeTone: "neutral", badgeText: "Ticket medio" },
      ],
    };
  },

  async getProductos({ desde, hasta, top, localId }) {
    const data = await reportesAnaliticosService.productosMasVendidos({ desde, hasta, top });
    const filas = data.filas || [];
    const totalIngresos = Number(data.totales?.ingresos || 0);
    const totalMargen = Number(data.totales?.margen || 0);
    const unidadesNetas = Number(data.totales?.unidades_netas || 0);
    const productosConPerdida = Number(data.totales?.productos_con_perdida || 0);
    const margenPorcentaje = totalIngresos > 0 ? (totalMargen / totalIngresos) * 100 : 0;

    // Gráfico complementario: Unidades vendidas vs devueltas
    const graficoComplementario = filas.length > 0 ? {
      data: [
        {
          type: "bar",
          name: "Unidades vendidas",
          x: filas.map((f) => f.codigo),
          y: filas.map((f) => Number(f.unidades_vendidas || 0)),
          marker: { color: "#2563eb" },
        },
        {
          type: "bar",
          name: "Unidades devueltas",
          x: filas.map((f) => f.codigo),
          y: filas.map((f) => Number(f.unidades_devueltas || 0)),
          marker: { color: "#dc2626" },
        },
      ],
      layout: {
        title: "Volumen comercial: unidades vendidas vs devoluciones por SKU",
        barmode: "group",
        xaxis: { title: "Código de producto" },
        yaxis: { title: "Unidades físicas" },
      },
    } : null;

    return {
      filas,
      totales: data.totales,
      grafico: data.grafico,
      graficoComplementario,
      kpis: [
        { label: "Margen comercial total", value: money(totalMargen), context: "Ganancia estimada de catálogo", badgeTone: totalMargen >= 0 ? "success" : "danger", badgeText: "Margen $" },
        { label: "Rentabilidad global", value: `${num(margenPorcentaje, 1)} %`, context: "Margen relativo sobre ingresos", badgeTone: margenPorcentaje >= 20 ? "success" : "warning", badgeText: "Margen %" },
        { label: "Ingresos netos por ventas", value: money(totalIngresos), context: `${num(unidadesNetas)} unidades comercializadas`, badgeTone: "neutral", badgeText: "Ingresos" },
        { label: "Productos operando a pérdida", value: num(productosConPerdida), context: "SKUs con margen negativo", badgeTone: productosConPerdida > 0 ? "danger" : "success", badgeText: productosConPerdida > 0 ? "Atención requerida" : "Saludable" },
        { label: "Volumen neto entregado", value: `${num(unidadesNetas)} u.`, context: "Neto de devoluciones del período", badgeTone: "neutral", badgeText: "Despachos" },
      ],
    };
  },

  async getTransito({ desde, hasta, localId }) {
    const data = await reportesAnaliticosService.tiemposTransito({ desde, hasta });
    let filas = data.filas || [];
    if (localId) {
      filas = filas.filter((f) => String(f.local_id) === String(localId));
    }
    const bultosTotal = filas.reduce((acc, f) => acc + Number(f.cantidad_bultos || 0), 0);
    const promedioHorasPonderado = bultosTotal > 0
      ? filas.reduce((acc, f) => acc + Number(f.promedio_horas || 0) * Number(f.cantidad_bultos || 0), 0) / bultosTotal
      : 0;
    const minimoHoras = filas.length > 0 ? Math.min(...filas.map((f) => Number(f.minimo_horas || 0))) : 0;
    const maximoHoras = filas.length > 0 ? Math.max(...filas.map((f) => Number(f.maximo_horas || 0))) : 0;

    // Gráfico complementario de volumen de bultos recibidos por local
    const graficoComplementario = filas.length > 0 ? {
      data: [{
        type: "bar",
        x: filas.map((f) => f.local_nombre),
        y: filas.map((f) => Number(f.cantidad_bultos || 0)),
        marker: { color: "#0891b2" },
        hovertemplate: "%{x}: %{y} bultos<extra></extra>",
      }],
      layout: {
        title: "Bultos recibidos por local destino",
        xaxis: { title: "Local receptor" },
        yaxis: { title: "Cantidad de bultos" },
      },
    } : null;

    return {
      filas,
      totales: { bultos_recibidos: bultosTotal },
      grafico: data.grafico,
      graficoComplementario,
      kpis: [
        { label: "Bultos recibidos en red", value: num(bultosTotal), context: "Envíos completados en el período", badgeTone: "neutral", badgeText: "Bultos" },
        { label: "Tránsito promedio red", value: `${num(promedioHorasPonderado, 1)} h`, context: "Desde despacho CD hasta recepción", badgeTone: promedioHorasPonderado <= 24 ? "success" : "warning", badgeText: "SLA promedio" },
        { label: "Entrega más ágil", value: `${num(minimoHoras, 1)} h`, context: "Mínimo tiempo registrado en red", badgeTone: "success", badgeText: "Récord red" },
        { label: "Demora máxima registrada", value: `${num(maximoHoras, 1)} h`, context: "Mayor tiempo de traslado registrado", badgeTone: maximoHoras > 48 ? "warning" : "neutral", badgeText: "Desvío máx." },
        { label: "Sedes monitoreadas", value: num(filas.length), context: "Puntos de entrega evaluados", badgeTone: "neutral", badgeText: "Locales" },
      ],
    };
  },

  async getStock({ ubicacionId, categoriaId, soloBajoMinimo }) {
    const data = await reportesService.getR1StockValorizacion({
      ubicacion_id: ubicacionId ? Number(ubicacionId) : undefined,
      categoria_id: categoriaId ? Number(categoriaId) : undefined,
      solo_bajo_minimo: soloBajoMinimo,
    });
    const items = data.items || [];
    const resumen = data.resumen || {};

    // Gráfico complementario: Unidades Disponibles vs En Tránsito por Sede
    const ubicacionesNombres = [...new Set(items.map((i) => i.ubicacion_nombre))];
    const graficoComplementario = ubicacionesNombres.length > 0 ? {
      data: [
        {
          type: "bar",
          name: "Disponible",
          x: ubicacionesNombres,
          y: ubicacionesNombres.map((name) =>
            items.filter((i) => i.ubicacion_nombre === name).reduce((sum, i) => sum + Number(i.cantidad_disponible || 0), 0)
          ),
          marker: { color: "#16a34a" },
        },
        {
          type: "bar",
          name: "En tránsito",
          x: ubicacionesNombres,
          y: ubicacionesNombres.map((name) =>
            items.filter((i) => i.ubicacion_nombre === name).reduce((sum, i) => sum + Number(i.cantidad_en_transito || 0), 0)
          ),
          marker: { color: "#f59e0b" },
        },
      ],
      layout: {
        title: "Composición física del stock: disponible vs en tránsito por sede",
        barmode: "group",
        xaxis: { title: "Ubicación" },
        yaxis: { title: "Unidades físicas" },
      },
    } : null;

    const tieneCriticos = (resumen.total_items_criticos || 0) > 0;

    return {
      filas: items,
      totales: resumen,
      grafico: data.grafico_valorizacion_por_ubicacion,
      graficoComplementario,
      kpis: [
        { label: "Valorización inventario (costo)", value: money(resumen.total_valorizado_costo), context: "Suma total (disponible x costo unitario)", badgeTone: "neutral", badgeText: "Patrimonio red" },
        { label: "Valorización potencial (venta)", value: money(resumen.total_valorizado_venta), context: `Margen proyectado: ${money(resumen.margen_total_potencial)}`, badgeTone: "success", badgeText: "Precio venta" },
        { label: "Margen potencial proyectado", value: money(resumen.margen_total_potencial), context: "Ganancia latente del inventario físico", badgeTone: "success", badgeText: "Margen latente" },
        { label: "Alertas stock crítico (Observer)", value: num(resumen.total_items_criticos), context: "Artículos en o bajo nivel mínimo", badgeTone: tieneCriticos ? "danger" : "success", badgeText: tieneCriticos ? "Atención requerida" : "Saludable" },
        { label: "Unidades físicas en red", value: `${num(resumen.total_unidades_disponibles)} disp. · ${num(resumen.total_unidades_en_transito)} trans.`, context: `${num(resumen.total_existencias)} unidades totales`, badgeTone: "neutral", badgeText: "Existencias" },
      ],
    };
  },

  async getMermas({ desde, hasta, localId }) {
    const data = await reportesService.getR2MermasPrecinto({
      fecha_inicio: desde,
      fecha_fin: hasta,
      local_destino_id: localId ? Number(localId) : undefined,
    });
    const bultos = data.bultos_rechazados || [];
    const resumen = data.resumen || {};
    const totalBultos = Number(resumen.total_bultos_rechazados || 0);
    const totalPerdidaCosto = Number(resumen.total_costo_merma || 0);
    const totalUnidades = Number(resumen.total_unidades_perdidas || 0);

    // Gráfico complementario: Unidades perdidas por local receptor
    const localesMermas = [...new Set(bultos.map((b) => b.destino_nombre || b.local_nombre))];
    const graficoComplementario = localesMermas.length > 0 ? {
      data: [{
        type: "bar",
        x: localesMermas,
        y: localesMermas.map((name) =>
          bultos.filter((b) => (b.destino_nombre || b.local_nombre) === name).reduce((sum, b) => sum + Number(b.total_unidades || b.unidades_perdidas || 0), 0)
        ),
        marker: { color: "#dc2626" },
        hovertemplate: "%{x}: %{y} unidades perdidas<extra></extra>",
      }],
      layout: {
        title: "Unidades damnificadas en tránsito por local receptor",
        xaxis: { title: "Local destino" },
        yaxis: { title: "Unidades perdidas" },
      },
    } : null;

    return {
      filas: bultos,
      totales: resumen,
      grafico: data.grafico_mermas_por_local,
      graficoComplementario,
      kpis: [
        { label: "Bultos rechazados (merma)", value: num(totalBultos), context: "Roturas de precinto y desvíos V1", badgeTone: totalBultos > 0 ? "danger" : "neutral", badgeText: "Regla V1" },
        { label: "Pérdida patrimonial (costo)", value: money(totalPerdidaCosto), context: "Costo real de mercadería excluida", badgeTone: totalPerdidaCosto > 0 ? "danger" : "neutral", badgeText: "No vendible" },
        { label: "Unidades damnificadas en ruta", value: `${num(totalUnidades)} u.`, context: "Mercadería no recepcionada", badgeTone: totalUnidades > 0 ? "danger" : "neutral", badgeText: "Excluidas" },
        { label: "Incidentes auditados", value: num(bultos.length), context: "Actas con peritaje forense disponible", badgeTone: "neutral", badgeText: "Bitácora" },
        { label: "Tasa de rechazo en destino", value: totalBultos > 0 ? "Auditada" : "0 %", context: "Peritaje de rotura en remitos", badgeTone: totalBultos > 0 ? "warning" : "success", badgeText: "Auditoría V1" },
      ],
    };
  },
};

export default reportesUnifiedService;
