// Guardia de arquitectura: max 500 lineas por archivo, cero estilos inline, sin em dashes,
// y verificación de requisitos de arquitectura US1 (IDs numéricos de sede, páginas dedicadas de catálogo y red).
// Uso: node scripts/check_frontend.mjs [--report]  (--report no falla, solo lista)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../src", import.meta.url));
const MAX_LINES = 500;
const report = process.argv.includes("--report");
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(name)) check(full);
  }
}

function check(file) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  const lines = text.split(/\r?\n/).length;
  if (lines > MAX_LINES) problems.push(`${rel}: ${lines} lineas (max ${MAX_LINES})`);
  if (/\.jsx?$/.test(file)) {
    const inline = (text.match(/style=\{\{/g) || []).length;
    if (inline) problems.push(`${rel}: ${inline} estilos inline`);
  }
  if (text.includes("\u2014")) problems.push(`${rel}: contiene em dash`);
  if (/font-weight:\s*(600|700|800|bold)/.test(text)) problems.push(`${rel}: font-weight no permitido`);
  if (/text-transform:\s*uppercase/.test(text)) problems.push(`${rel}: text-transform uppercase`);
}

function checkUS1Requirements() {
  const sedeProviderText = readFileSync(join(ROOT, "app/providers/SedeProvider.jsx"), "utf8");
  if (!sedeProviderText.includes("/api/stock/ubicaciones")) {
    problems.push("SedeProvider.jsx: no consume /api/stock/ubicaciones");
  }
  const appShellText = readFileSync(join(ROOT, "shared/components/AppShell.jsx"), "utf8");
  if (appShellText.includes('"CD-01"') || appShellText.includes("'CD-01'")) {
    problems.push("AppShell.jsx: DEFAULT_LOCATIONS mantiene ID alfanumérico en lugar de numérico");
  }
  const persistentNavigation = [
    "const [expandedGroups, setExpandedGroups]",
    "new Set([...current, activeGroup])",
    "const isExpanded = expandedGroups.has(group.id);",
    "const next = new Set(current);",
  ];
  if (!persistentNavigation.every((requirement) => appShellText.includes(requirement))) {
    problems.push("AppShell.jsx: la navegación no conserva un único grupo expandido");
  }

  const catalogPages = ["ProductosPage.jsx", "CategoriasPage.jsx", "ProveedoresPage.jsx", "PreciosPage.jsx"];
  for (const pageName of catalogPages) {
    try {
      statSync(join(ROOT, "modules/catalogo/pages", pageName));
    } catch {
      problems.push(`Falta la página de catálogo requerida: modules/catalogo/pages/${pageName}`);
    }
  }

  const stockPages = ["StockPage.jsx", "IngresosPage.jsx", "AlertasPage.jsx", "UbicacionesPage.jsx"];
  for (const pageName of stockPages) {
    try {
      statSync(join(ROOT, "modules/ubicaciones_stock/pages", pageName));
    } catch {
      problems.push(`Falta la página de stock requerida: modules/ubicaciones_stock/pages/${pageName}`);
    }
  }
}

function checkUS7Requirements() {
  try {
    statSync(join(ROOT, "modules/reportes/pages/ReporteImprimiblePage.jsx"));
  } catch {
    problems.push("Falta la página de reporte imprimible requerida: modules/reportes/pages/ReporteImprimiblePage.jsx");
  }

  const reportesRoutesText = readFileSync(join(ROOT, "modules/reportes/index.jsx"), "utf8");
  if (!reportesRoutesText.includes("ReporteImprimiblePage")) {
    problems.push("modules/reportes/index.jsx: no registra ReporteImprimiblePage");
  }

  const exportToolbarText = readFileSync(join(ROOT, "modules/reportes/components/ReporteExportToolbar.jsx"), "utf8");
  if (!exportToolbarText.includes("/reportes/imprimible")) {
    problems.push("ReporteExportToolbar.jsx: no redirige la exportación PDF a /reportes/imprimible");
  }

  const reportesDetailsCss = readFileSync(join(ROOT, "modules/reportes/reportes-details.css"), "utf8");
  if (!reportesDetailsCss.includes("landscape-appendix") || !reportesDetailsCss.includes("stocky-print-appendix-landscape")) {
    problems.push("reportes-details.css: falta la configuración del apéndice apaisado para tablas anchas");
  }

  const reportesPageText = readFileSync(join(ROOT, "modules/reportes/pages/ReportesPage.jsx"), "utf8");
  if (!reportesPageText.includes("¿Dónde está el stock y cuál es su valorización?") ||
      !reportesPageText.includes("¿Dónde se originaron las mermas y violaciones de precintos?")) {
    problems.push("ReportesPage.jsx: no contiene las preguntas operacionales estructuradas");
  }
}

function checkRoleRouteRequirements() {
  const routerText = readFileSync(join(ROOT, "app/router.jsx"), "utf8");
  const requiredRoutes = ["/login", "/operador", "dashboard"];
  for (const r of requiredRoutes) {
    if (!routerText.includes(r)) {
      problems.push(`router.jsx: falta ruta requerida para roles: ${r}`);
    }
  }
}

walk(ROOT);
checkUS1Requirements();
checkUS7Requirements();
checkRoleRouteRequirements();

if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n${problems.length} incumplimientos`);
  process.exit(report ? 0 : 1);
}
console.log("Frontend cumple las reglas de arquitectura y requisitos US1/US7.");
