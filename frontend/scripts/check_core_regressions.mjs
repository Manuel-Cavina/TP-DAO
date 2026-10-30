import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { isOperatorPathAllowed } from "../src/app/auth/rolePolicy.js";
import { navigationFocusTarget } from "../src/shared/lib/navigationFocus.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

for (const route of ["/logistica/recepcion", "/logistica/trazabilidad", "/logistica/ordenes/15", "/logistica/remitos/REM-1", "/logistica/bultos/1", "/logistica/operaciones", "/logistica/empaquetado"]) assert.equal(isOperatorPathAllowed(route), true, route);
for (const route of ["/catalogo/productos", "/dashboard", "/ventas", "/reportes/stock", "/logistica", "/logistica/ordenes/crear", "/logistica/ordenes/nueva", "/logistica/wizard", "/logistica/ordenes/0"]) assert.equal(isOperatorPathAllowed(route), false, route);
const nodes = [{ id: "first" }, { id: "middle" }, { id: "last" }];
assert.equal(navigationFocusTarget(nodes, nodes[2], false), nodes[0]);
assert.equal(navigationFocusTarget(nodes, nodes[0], true), nodes[2]);
assert.equal(navigationFocusTarget(nodes, nodes[1], false), null);
assert.equal(navigationFocusTarget(nodes, {}, false), nodes[0]);
assert.equal(navigationFocusTarget([], {}, false), null);

// Execute the production hook with a deterministic hooks/effects scheduler. No DOM or network.
function createHookHarness() {
  let slots = [], cursor = 0, effects = [], cleanups = new Map(), timers = new Map(), nextTimer = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
  };
  const useRef = (initial) => { const index = cursor++; return slots[index] ||= { current: initial }; };
  const useCallback = (fn, deps) => { const index = cursor++; if (!equal(slots[index]?.deps, deps)) slots[index] = { fn, deps }; return slots[index].fn; };
  const useEffect = (fn, deps) => { const index = cursor++; if (!equal(slots[index]?.deps, deps)) { slots[index] = { deps }; effects.push([index, fn]); } };
  const source = read("src/shared/hooks/useLiveResource.jsx").split("export function LiveIndicator")[0].replace(/^import[^\n]+\n/, "").replace("export function useLiveResource", "function useLiveResource");
  const hook = new Function("useState", "useRef", "useCallback", "useEffect", "setInterval", "clearInterval", `${source}\nreturn useLiveResource;`)(useState, useRef, useCallback, useEffect, (fn) => { timers.set(++nextTimer, fn); return nextTimer; }, (id) => timers.delete(id));
  return {
    render(fetcher, options) { cursor = 0; const result = hook(fetcher, options); const pending = effects; effects = []; for (const [index, effect] of pending) { cleanups.get(index)?.(); cleanups.set(index, effect()); } return result; },
    unmount() { for (const cleanup of cleanups.values()) cleanup?.(); timers.clear(); },
    poll() { for (const callback of [...timers.values()]) callback(); },
  };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const harness = createHookHarness();
let pendingA = deferred(), pendingB = deferred(), signalA, signalB, fetchesB = 0;
const fetchA = ({ signal }) => { signalA = signal; return pendingA.promise; };
const fetchB = ({ signal }) => { fetchesB++; signalB = signal; return pendingB.promise; };
harness.render(fetchA, { resourceKey: "A" });
let switched = harness.render(fetchB, { resourceKey: "B" });
assert.equal(signalA.aborted, true, "Changing entity cancels the previous request");
assert.equal(switched.data, null, "Changing entity never exposes prior data");
assert.equal(fetchesB, 1, "Changing entity fetches immediately, not after polling");
pendingB.resolve({ id: "B" }); await settle();
pendingA.resolve({ id: "A" }); await settle();
assert.deepEqual(harness.render(fetchB, { resourceKey: "B" }).data, { id: "B" }, "Late stale response cannot overwrite current data");
pendingB = deferred();
const refreshing = harness.render(fetchB, { resourceKey: "B" }).refresh();
pendingB.reject(new Error("offline")); await refreshing;
const failed = harness.render(fetchB, { resourceKey: "B" });
assert.deepEqual(failed.data, { id: "B" }, "Same-entity failure preserves last known data");
assert.equal(failed.isStale, true);
pendingB = deferred(); harness.render(fetchB, { resourceKey: "B" }).refresh();
harness.unmount(); assert.equal(signalB.aborted, true, "Unmount cancels outstanding requests");
pendingB.resolve({ id: "late" }); await settle();

const shell = read("src/shared/components/AppShell.jsx");
for (const marker of ["sidebarRef.current.inert", "mainRef.current.inert = true", 'event.key === "Escape"', "menuTriggerRef.current?.focus()", 'aria-controls="stocky-navigation"', "Cerrar navegación"]) assert.ok(shell.includes(marker), `Mobile navigation contract: ${marker}`);
const operator = read("src/app/dashboard/OperatorDashboardPage.jsx");
assert.match(operator, /!loading && !loadError && branches.length > 0 && !work.total/);
assert.match(operator, /await logout\(\)/);
assert.match(operator, /Reintentar/);
assert.doesNotMatch(operator, /assigned.length \? assigned : locales/);
assert.match(read("index.html"), /<script type="module" src="\/src\/main.jsx"><\/script>/);
assert.match(read("src/main.jsx"), /import "\.\/shared\/styles\/shared-ui.css"/);
if (process.argv.includes("--build")) {
  assert.ok(existsSync(new URL("../dist/index.html", import.meta.url)), "Build must emit an HTML entry");
  const html = read("dist/index.html");
  assert.doesNotMatch(html, /\/src\//, "Release HTML must not reference source files");
  const assets = readdirSync(new URL("../dist/assets", import.meta.url));
  assert.ok(assets.some((name) => name.endsWith(".css")), "Build must emit CSS");
  assert.ok(assets.some((name) => name.endsWith(".js")), "Build must emit JavaScript");
}
console.log("Core regressions passed: role policy, focus loop, live resource identity/cancellation, operator errors and release entry.");
