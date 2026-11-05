import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderWorkflowSteps } from "../src/modules/logistica/components/workflowPresentation.js";
import { validateSealControl } from "../src/modules/logistica/mappers/sealControl.js";

const read = (file) => readFileSync(new URL(`../src/modules/logistica/${file}`, import.meta.url), "utf8");
const detail = (order, shipment) => orderWorkflowSteps(order, shipment).find((s) => s.tab === "recepcion").detail;
assert.equal(detail({ estado: "PENDIENTE" }), "Arribo pendiente");
assert.equal(detail({ estado: "EN_PREPARACION" }, { estado: "EMITIDO" }), "Arribo pendiente");
assert.equal(detail({ estado: "DESPACHADA" }, { estado: "DESPACHADO" }), "Registrar arribo");
assert.equal(detail({ estado: "DESPACHADA" }, { estado: "RECIBIDO" }), "Controlar y cerrar");
assert.equal(detail({ estado: "CERRADA" }, { estado: "CERRADO" }), "Recepción cerrada");
assert.deepEqual(orderWorkflowSteps({}, {}).map((s) => s.tab), ["resumen", "empaque", "despacho", "recepcion", "historial"]);
const frozenOrder = Object.freeze({ estado: "PENDIENTE" });
const frozenShipment = Object.freeze({ estado: "EMITIDO" });
orderWorkflowSteps(frozenOrder, frozenShipment);
assert.ok(validateSealControl({ precintoEsperado: "S1", precintoLeido: "", resultado: "" }).error);
assert.equal(validateSealControl({ precintoEsperado: "S1", precintoLeido: "S1", resultado: "INTACTO" }).rejected, false);
assert.ok(validateSealControl({ precintoEsperado: "S1", precintoLeido: "OTHER", resultado: "INTACTO" }).error);
assert.equal(validateSealControl({ precintoEsperado: "S1", precintoLeido: "OTHER", resultado: "VIOLADO", motivoRechazo: "Seal differs" }).rejected, true);

// Static wiring guards supplement the exercised helpers, not browser coverage.
assert.match(read("pages/OperacionesPage.jsx"), /\[viewMode, setViewMode\] = useState\("list"\)/);
assert.match(read("pages/OperacionesPage.jsx"), /onDropOrder=\{handleDropOrder\}/);
const rail = read("components/OrderWorkflowRail.jsx");
assert.match(rail, /onClick=\{\(\) => onSelect\(step.tab\)\}/);
assert.doesNotMatch(rail, /logisticaService|http\.|fetch\(/);
assert.match(read("pages/OrdenDetallePage.jsx"), /<OrderWorkflowRail activeTab=\{activeTab\}/);
assert.match(read("pages/OrdenDetallePage.jsx"), /logistics-order-context/);
assert.match(read("pages/OrdenDetallePage.jsx"), /disabled=\{isStale \|\| isLoading\}/);
assert.match(read("pages/EmpaquetadoPage.jsx"), /Solicitadas <strong>\{totalSolicitadas\}/);
assert.match(read("components/OrdenKanban.jsx"), /row\.stage === 3 && row\.approvalsPending > 0/);
for (const file of ["components/OrdenKanban.jsx", "components/RemitoKanban.jsx"]) {
  assert.doesNotMatch(read(file), /2026-10-28T10:30:00/);
}
const reception = read("pages/RecepcionPage.jsx");
assert.doesNotMatch(reception, /setCodigoIngresado\(targetBulto\.codigoPrecinto\)/);
assert.match(reception, /Registrar bulto verificado/);
assert.match(reception, /validateSealControl\(/);
assert.match(reception, /preCierreModal\.onOpen/);
assert.doesNotMatch(read("components/CrearOrdenPaso2.jsx"), /totalBultosEstimados|Post-reserva|100%/);
assert.match(read("pages/CrearOrdenPage.jsx"), /necesidad_ids: necIdsArray/);
const css = read("logistics-workbench.css");
assert.doesNotMatch(css, /#[a-f\d]{3,8}\b|(?:linear|radial)-gradient|:root|!important/i);
assert.match(css, /\.logistics-catalog \{ grid-row: 2;/);
assert.match(css, /@media \(max-width: 900px\)/);
console.log("PASS logistics redesign: lifecycle presentation, deliberate seal reading, safe navigation and scoped desktop layout");
