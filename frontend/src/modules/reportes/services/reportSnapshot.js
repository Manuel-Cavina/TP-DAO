export const REPORT_VERSION = 1;
export const reportMoney = (value) => value == null ? "No disponible" : `$${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const sealLabel = (value) => value == null ? "No informado" : value ? "Intacto" : "Violado";

export function actorLabel(user) {
  return user?.displayName || user?.name || user?.login || "Usuario no identificado";
}

export function createReportSnapshot({ reportKey, data, filters = {}, filterDescription = "", user, generatedAt = new Date().toISOString() }) {
  if (!["r1", "r2"].includes(reportKey) || !data?.resumen || !Array.isArray(reportKey === "r1" ? data.items : data.bultos_rechazados)) {
    throw new Error("El reporte no tiene datos válidos para exportar.");
  }
  return JSON.parse(JSON.stringify({ version: REPORT_VERSION, reportKey, generatedAt, actor: { id: user?.id ?? null, label: actorLabel(user) }, filters, filterDescription, data }));
}

export function saveReportSnapshot(storage, snapshot, id) {
  const prefix = "stocky-report-snapshot:";
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key) => key?.startsWith(prefix));
  keys.slice(0, Math.max(0, keys.length - 9)).forEach((key) => storage.removeItem(key));
  storage.setItem(`${prefix}${id}`, JSON.stringify(snapshot));
  return id;
}

export function readReportSnapshot(storage, id, userId) {
  const raw = storage.getItem(`stocky-report-snapshot:${id}`);
  if (!raw) throw new Error("La captura del reporte ya no está disponible. Volvé al reporte y generala nuevamente.");
  const snapshot = JSON.parse(raw);
  if (snapshot.version !== REPORT_VERSION || snapshot.actor?.id !== userId) throw new Error("La captura no pertenece a la sesión activa.");
  createReportSnapshot({ reportKey: snapshot.reportKey, data: snapshot.data });
  return snapshot;
}

export function buildPrintUrl(href, params) {
  const url = new URL(href);
  url.search = "";
  url.hash = `/reportes/imprimible?${params.toString()}`;
  return url.href;
}
