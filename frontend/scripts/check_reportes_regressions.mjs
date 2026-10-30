import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reportesService } from "../src/modules/reportes/services/reportesService.js";
import { buildPrintUrl, createReportSnapshot, readReportSnapshot, saveReportSnapshot, reportMoney, sealLabel } from "../src/modules/reportes/services/reportSnapshot.js";

const originalFetch = globalThis.fetch;
const fixtures = {
  "/api/reportes/existencias": { filas: [
    { producto_id: 1, codigo: "SKU-1", nombre: "Agua", ubicacion_id: 10, ubicacion_nombre: "CD", cantidad_disponible: 5, cantidad_en_transito: 3, nivel_minimo_existencia: 6, en_o_bajo_minimo: true, valorizacion: "50.00" },
    { producto_id: 2, codigo: "SKU-2", nombre: "Arroz", ubicacion_id: 10, ubicacion_nombre: "CD", cantidad_disponible: 7, cantidad_en_transito: 0, nivel_minimo_existencia: 2, en_o_bajo_minimo: false, valorizacion: "140.00" },
  ], grafico: { data: [{ y: [999999] }] } },
  "/api/catalogo/productos": [{ id: 1, codigo: "SKU-1", nombre: "Agua", categoria_id: 1, costo_unitario: "10", precio_venta: "15" }, { id: 2, categoria_id: 2, costo_unitario: "20", precio_venta: "30" }],
  "/api/ubicaciones": [{ id: 10, nombre: "CD", tipo: "CD" }],
  "/api/catalogo/categorias": [{ id: 1, nombre: "Bebidas" }, { id: 2, nombre: "Almacén" }],
  "/api/reportes/mermas": { filas: [{ bulto_id: 4, local_nombre: "Local Norte", unidades_perdidas: 3, valor_perdido: "30" }], totales: { bultos_rechazados: 1, unidades_perdidas: 3, valor_perdido: "30" } },
  "/api/logistica/bultos/4/trazabilidad": { bulto_id: 4, orden_id: 8, codigo_precinto: "PC-REAL", estado_actual: "RECHAZADO", total_items: 3, eventos: [{ estado_anterior: "RECIBIDO", estado_nuevo: "RECHAZADO", fecha_hora: "2026-10-28T10:00:00", observacion: "Precinto roto" }] },
};
globalThis.fetch = async (url) => {
  const body = fixtures[new URL(url).pathname];
  assert.notEqual(body, undefined, `Unexpected request: ${url}`);
  return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => structuredClone(body) };
};

try {
  // FR-035: physical quantities are not the number of product/location rows.
  const stock = await reportesService.getR1StockValorizacion();
  assert.equal(stock.resumen.total_existencias, 15);
  assert.equal(stock.resumen.total_registros, 2);
  assert.equal(stock.resumen.total_unidades_disponibles, 12);
  assert.equal(stock.items[0].total_existencias, 8);
  const filtered = await reportesService.getR1StockValorizacion({ categoria_id: 1 });
  assert.equal(filtered.resumen.total_valorizado_costo, 50);
  assert.deepEqual(filtered.grafico_valorizacion_por_ubicacion.data[0].y, [50]);
  const detail = await reportesService.getR1DrillDown(1);
  assert.equal(detail.categoria_nombre, "Bebidas");

  // Missing API evidence must never become an invented zero or broken seal.
  const losses = await reportesService.getR2MermasPrecinto();
  const row = losses.bultos_rechazados[0];
  assert.equal(row.precinto_intacto, null);
  assert.equal(row.codigo_precinto, null);
  assert.equal(row.total_perdida_venta, null);
  const trace = await reportesService.getR2DrillDown(4, row);
  assert.equal(trace.linea_de_tiempo[0].observacion, "Precinto roto");
  assert.equal(trace.codigo_precinto, "PC-REAL");
  assert.equal(trace.costo_total_merma, 30);
  assert.equal(trace.valor_venta_merma, null);
  assert.equal(trace.destino.nombre, "Local Norte");
  await assert.rejects(reportesService.getR2MermasPrecinto({ fecha_inicio: "2026-10-29", fecha_fin: "2026-10-01" }));
  assert.equal(reportMoney(null), "No disponible");
  assert.notEqual(reportMoney(0), "No disponible");
  assert.equal(sealLabel(null), "No informado");
  assert.equal(sealLabel(false), "Violado");

  // HashRouter and deployment subpaths survive both popup and same-tab fallback URLs.
  const params = new URLSearchParams({ reporte: "stock", snapshot: "abc" });
  const printUrl = new URL(buildPrintUrl("https://stocky.test/erp/index.html#/reportes/stock", params));
  assert.equal(printUrl.pathname, "/erp/index.html");
  assert.equal(printUrl.hash, "#/reportes/imprimible?reporte=stock&snapshot=abc");
  const source = { ...stock, items: stock.items.map((item) => ({ ...item })) };
  const snapshot = createReportSnapshot({ reportKey: "r1", data: source, filters: { categoria_id: 1 }, user: { id: 9, displayName: "Auditor Real" }, generatedAt: "2026-10-29T10:00:00Z" });
  source.items[0].cantidad_disponible = 999;
  assert.equal(snapshot.data.items[0].cantidad_disponible, 5);
  assert.equal(snapshot.actor.label, "Auditor Real");
  const values = new Map();
  const storage = { get length() { return values.size; }, key: (index) => [...values.keys()][index], setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key), removeItem: (key) => values.delete(key) };
  saveReportSnapshot(storage, snapshot, "abc");
  assert.deepEqual(readReportSnapshot(storage, "abc", 9), snapshot);
  assert.throws(() => readReportSnapshot(storage, "abc", 10));
  assert.throws(() => readReportSnapshot(storage, "missing", 9));

  // Wiring guards complement the executable service/snapshot checks above.
  const hook = readFileSync(new URL("../src/modules/reportes/hooks/useReportes.js", import.meta.url), "utf8");
  assert.ok(hook.includes("setMastersError(error)"));
  assert.ok(hook.includes("setErrorR1DrillDown(error)"));
  assert.ok(hook.includes("setErrorR2DrillDown(error)"));
  assert.ok(hook.includes("request === generations.current.r1"));
  const printable = readFileSync(new URL("../src/modules/reportes/pages/ReporteImprimiblePage.jsx", import.meta.url), "utf8");
  assert.ok(printable.includes("readReportSnapshot(window.sessionStorage, snapshotId, user?.id)"));
  assert.ok(printable.includes("!loading && !error && reportData && autoPrint"));
  assert.ok(!printable.includes("Martín Gómez"));
  console.log("Report regressions passed: quantity/filters, real traceability, null evidence, snapshot isolation, hash routing and error wiring.");
} finally { globalThis.fetch = originalFetch; }
