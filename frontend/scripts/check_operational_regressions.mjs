import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterProducts } from "../src/modules/catalogo/mappers/productFilters.js";
import { createSealControlRows, validateSealControl, readApprovalOutcome } from "../src/modules/logistica/mappers/sealControl.js";

const read = (path) => readFileSync(new URL(`../src/modules/${path}`, import.meta.url), "utf8");
function loadService(path, name, http) {
  const source = read(path).replace(/^import[^;]+;\s*/m, "").replace(`export const ${name}`, `const ${name}`);
  return new Function("http", `${source}; return ${name};`)(http);
}

const products = [
  { codigo: "A", nombre: "Active", activo: true, categoriaId: 1 },
  { codigo: "B", nombre: "Inactive", activo: false, categoriaId: 1 },
  { codigo: "C", nombre: "Other", activo: true, categoriaId: 2 },
];
assert.deepEqual(filterProducts(products).map((item) => item.codigo), ["A", "B", "C"]);
assert.deepEqual(filterProducts(products, { estado: "activos" }).map((item) => item.codigo), ["A", "C"]);
assert.deepEqual(filterProducts(products, { estado: "inactivos", categoriaId: "1", search: "ina" }).map((item) => item.codigo), ["B"]);

const rows = createSealControlRows([{ id: 4, codigoPrecinto: "SEAL-4" }]);
assert.equal(rows[0].precintoEsperado, "SEAL-4");
assert.equal(rows[0].precintoLeido, "", "Physical reading must never be copied from expected code");
assert.equal(rows[0].resultado, "", "The operator must make an explicit decision");
assert.ok(validateSealControl(rows[0]).error);
assert.ok(validateSealControl({ ...rows[0], precintoLeido: "SEAL-4" }).error);
assert.equal(validateSealControl({ ...rows[0], precintoLeido: "SEAL-4", resultado: "INTACTO" }).rejected, false);
assert.ok(validateSealControl({ ...rows[0], precintoLeido: "OTHER", resultado: "INTACTO" }).error);
assert.equal(validateSealControl({ ...rows[0], precintoLeido: "OTHER", resultado: "INTACTO", motivoRechazo: "Mismatch" }).resultado, "VIOLADO");
assert.ok(validateSealControl({ ...rows[0], precintoLeido: "SEAL-4", resultado: "VIOLADO" }).error);
assert.equal(validateSealControl({ ...rows[0], precintoLeido: "SEAL-4", resultado: "VIOLADO", motivoRechazo: "Cut" }).rejected, true);

const outcome = readApprovalOutcome({ approved: [4], blocked: [{ id: 5, motivo: "Not sealed" }] });
assert.deepEqual(outcome.approved, [4]);
assert.equal(outcome.approved.includes(5), false);
assert.equal(outcome.blocked[0].motivo, "Not sealed");
assert.throws(() => readApprovalOutcome({ ok: true }), /inválida/);

const calls = [];
let rejectBatch = true;
let registrationFailure = false;
const service = loadService("logistica/services/logisticaService.js", "logisticaService", {
  post: async (url, body) => {
    calls.push({ url, body });
    if (url.endsWith("/precintos")) {
      if (registrationFailure) throw Object.assign(new Error("Unavailable"), { status: 503 });
      throw Object.assign(new Error("Already registered"), { status: 409 });
    }
    if (rejectBatch) throw Object.assign(new Error("Used seal"), { status: 400 });
    return [{ id: 4, estado: "PRECINTADO" }, { id: 5, estado: "PRECINTADO" }];
  },
});
const assignments = [{ bultoId: 4, codigoPrecinto: "SEAL-4" }, { bultoId: 5, codigoPrecinto: "SEAL-5" }];
await assert.rejects(service.precintarLoteRevisado(8, assignments), /Used seal/);
assert.equal(calls.filter((call) => /bultos\/\d+\/precintar$/.test(call.url)).length, 0, "Never assign packages individually during batch sealing");
assert.equal(calls.filter((call) => call.url === "/api/logistica/ordenes/8/bultos/precintar").length, 1);
assert.deepEqual(calls.at(-1).body, { items: [{ bulto_id: 4, codigo_precinto: "SEAL-4" }, { bulto_id: 5, codigo_precinto: "SEAL-5" }] });
rejectBatch = false;
assert.equal((await service.precintarLoteRevisado(8, assignments)).length, 2, "Retry must reuse registered but unassigned seals after 409");
calls.length = 0;
registrationFailure = true;
await assert.rejects(service.precintarLoteRevisado(8, assignments), /Unavailable/);
assert.equal(calls.length, 1, "Registration failure must not attempt any package assignment");

let reactivationRequest;
const locations = loadService("ubicaciones_stock/services/ubicacionesService.js", "ubicacionesService", {
  post: async (url, body) => { reactivationRequest = { url, body }; return { id: 7, activo: true }; },
});
assert.equal((await locations.reactivar(7)).activo, true);
assert.deepEqual(reactivationRequest, { url: "/api/ubicaciones/7/reactivar", body: {} });

// Wiring assertions below are static, not mounted UI or browser tests.
assert.match(read("catalogo/pages/ProductosPage.jsx"), /useProductos\(\{ activos: false \}\)/);
assert.match(read("ubicaciones_stock/pages/UbicacionesPage.jsx"), /await reloadSedes\(\)/);
assert.doesNotMatch(read("ubicaciones_stock/pages/UbicacionesPage.jsx"), /row\.tipo === "LOCAL" && row\.activo/);
assert.doesNotMatch(read("ubicaciones_stock/components/UbicacionModal.jsx"), /isCDDeactivate/);
assert.match(read("logistica/pages/EmpaquetadoPage.jsx"), /readApprovalOutcome\(await logisticaService\.aprobarBultosLote/);
for (const path of ["logistica/pages/OrdenDetallePage.jsx", "logistica/pages/RemitoDetallePage.jsx", "logistica/pages/BultoDetallePage.jsx", "logistica/pages/EmpaquetadoPage.jsx", "logistica/pages/RecepcionPage.jsx", "ubicaciones_stock/hooks/useStockMatriz.js"]) {
  assert.match(read(path), /resourceKey:/, `${path} must identify its resource`);
  assert.match(read(path), /\{ signal \}/, `${path} must forward request cancellation`);
}
assert.doesNotMatch(read("logistica/pages/BultoDetallePage.jsx"), /setLectura\(precinto/);
assert.doesNotMatch(read("logistica/pages/RecepcionPage.jsx"), /setCodigoIngresado\(bulto\.codigoPrecinto/);
assert.match(read("logistica/components/ControlPrecintosModal.jsx"), /htmlFor=\{`seal-read-/);
assert.match(read("logistica/components/ControlPrecintosModal.jsx"), /aria-describedby=/);
console.log("Operational regression checks passed (behavioral helpers/services + explicitly static UI wiring).");
