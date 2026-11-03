/**
 * Utilidades de fecha y tiempo seguras para zona horaria local e ISO.
 */

export function isDateToday(fechaVal) {
  if (!fechaVal) return false;
  const d = new Date(fechaVal);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const hoyInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hoyFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (d >= hoyInicio && d <= hoyFin) return true;
  // Fallback por prefijo ISO YYYY-MM-DD
  const isoDate = typeof fechaVal === "string" ? fechaVal.slice(0, 10) : "";
  const todayIso = now.toISOString().slice(0, 10);
  return isoDate === todayIso;
}
