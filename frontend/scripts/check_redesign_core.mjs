import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const aliases = read("src/shared/styles/wireframe-tokens.css");
assert.doesNotMatch(aliases, /(--[\w-]+):\s*var\(\1[,)]/, "Legacy aliases must not invalidate canonical tokens through self-reference");
assert.doesNotMatch(aliases, /color-scheme:\s*dark/, "The legacy stylesheet must not force a dark default");
const { matchNavigation, ADMIN_TASK_GROUPS, OPERATOR_TASK_GROUPS } = await import("../src/shared/lib/navigation.js");
assert.equal(matchNavigation("/ventas?tab=facturas").item.id, "ventas-caja");
assert.equal(matchNavigation("/ventas?tab=devoluciones&localId=4").item.id, "ventas-devoluciones");
assert.equal(matchNavigation("/ventas?tab=pos").item.id, "ventas-pos");
assert.equal(matchNavigation("/ventas").item.id, "ventas-pos");
assert.equal(matchNavigation("/logistica/trazabilidad?q=PREC-1").group.id, "distribucion");
assert.equal(matchNavigation("/logistica/ordenes/16?tab=recepcion").item.id, "distribucion-ordenes");
assert.equal(matchNavigation("/reportes/stock").item.id, "control-stock");
assert.equal(matchNavigation("/logistica/operaciones", OPERATOR_TASK_GROUPS).group.id, "operaciones");
const paths = ADMIN_TASK_GROUPS.flatMap((group) => group.items.map((item) => item.path));
assert.equal(new Set(paths).size, paths.length, "Each destination has exactly one navigation owner");
const { summarizeDashboard } = await import("../src/app/dashboard/dashboardMetrics.js");
const empty = summarizeDashboard({ ordenes: [], remitos: [], ventas: [], alertas: [], necesidades: [], productos: [] });
assert.equal(empty.salesTotal, 0, "Real zero sales must stay zero");
assert.equal(empty.orderCount, 0);
assert.equal(empty.productCount, 0);
assert.equal(empty.salesCount, 0);
assert.equal(summarizeDashboard({}).salesTotal, null, "Unavailable data is not zero");
const actual = summarizeDashboard({
  ordenes: [{ estado: "PENDIENTE" }, { estado: "COMPLETADA" }],
  remitos: [{ estado: "EMITIDO" }, { estado: "EN_TRANSITO" }, { estado: "RECIBIDO" }, { estado: "CERRADO" }],
  ventas: [{ total: "10.25" }, { total: 2.5 }], alertas: [{ leida: false }, { leida: true }],
  necesidades: [], productos: [{ id: 1 }],
});
assert.equal(actual.salesTotal, 12.75);
assert.equal(actual.ordersToPrepare, 1);
assert.equal(actual.remitosToDispatch, 1);
assert.equal(actual.remitosToReceiveOrControl, 2, "Receipt work counts remitos, never packages");
assert.equal(actual.stockAlerts, 1);
const hook = read("src/app/dashboard/useAdminDashboard.js");
for (const fiction of ["191700", "+15%", "+12.4%", "18 de 20", "admin@stocky", "progresoGeneral: 75"]) assert.ok(!hook.includes(fiction), `No invented dashboard evidence: ${fiction}`);
assert.doesNotMatch(read("src/app/dashboard/OperatorDashboardPage.module.css"), /max-width:\s*440px/);
console.log("Desktop redesign core passed: token ownership, specific route matching, role navigation, truthful dashboard totals and desktop operator geometry.");
