export function createSealControlRows(bultos = []) {
  return bultos.map((bulto) => ({
    bultoId: bulto.id,
    version: bulto.version || 1,
    codigoBulto: bulto.codigo || `BLT-${String(bulto.id).padStart(4, "0")}`,
    precintoEsperado: bulto.codigoPrecinto || "",
    precintoLeido: "",
    resultado: "",
    motivoRechazo: "",
    error: "",
  }));
}

export function validateSealControl({ precintoEsperado, precintoLeido, resultado, motivoRechazo }) {
  const read = String(precintoLeido || "").trim();
  const reason = String(motivoRechazo || "").trim();
  const mismatch = Boolean(read && precintoEsperado && read !== precintoEsperado.trim());
  if (!read) return { error: "Ingrese el código de precinto leído." };
  if (!["INTACTO", "VIOLADO"].includes(resultado)) {
    return { error: "Seleccione explícitamente Intacto o Violado." };
  }
  const rejected = resultado === "VIOLADO" || mismatch;
  if (rejected && !reason) return { error: "Indique el motivo del precinto violado o código discrepante." };
  return { error: "", rejected, read, reason, resultado: rejected ? "VIOLADO" : "INTACTO" };
}

export function readApprovalOutcome(response) {
  if (!Array.isArray(response?.approved) || !Array.isArray(response?.blocked)) {
    throw new Error("Respuesta de aprobación inválida; actualice la orden antes de continuar.");
  }
  return { approved: response.approved, blocked: response.blocked };
}
