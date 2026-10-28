import React from "react";

/**
 * Arc UI Badge & StatusBadge (`frontend/src/shared/components/Badge.jsx`)
 * Sentence case status pills mapped to ERP domain states (`State`, `Observer`, `CD`/`Local`).
 */

const ERP_STATUS_MAP = {
  PENDIENTE: { tone: "warning", label: "Pendiente" },
  EN_PREPARACION: { tone: "warning", label: "En preparación" },
  DESPACHADA: { tone: "info", label: "Despachada" },
  CERRADA: { tone: "success", label: "Cerrada" },
  EMITIDO: { tone: "neutral", label: "Emitido" },
  DESPACHADO: { tone: "info", label: "Despachado" },
  EN_TRANSITO: { tone: "warning", label: "En tránsito" },
  RECIBIDO: { tone: "info", label: "Recibido" },
  PREPARADO: { tone: "neutral", label: "Preparado" },
  PRECINTADO: { tone: "warning", label: "Precintado" },
  VERIFICADO: { tone: "success", label: "Verificado" },
  RECHAZADO: { tone: "danger", label: "Rechazado (merma)" },
  Preparado: { tone: "neutral", label: "Preparado" },
  Precintado: { tone: "warning", label: "Precintado" },
  En_Transito: { tone: "warning", label: "En tránsito" },
  "En tránsito": { tone: "warning", label: "En tránsito" },
  Recibido: { tone: "info", label: "Recibido" },
  Verificado: { tone: "success", label: "Verificado" },
  Rechazado: { tone: "danger", label: "Rechazado (merma)" },
  Saludable: { tone: "success", label: "Stock saludable" },
  Bajo_Minimo: { tone: "warning", label: "Bajo mínimo (Observer)" },
  CD: { tone: "cd", label: "CD Central" },
  Local: { tone: "local", label: "Local comercial" },
};

export function Badge({
  tone = "neutral",
  dot = true,
  children,
  className = "",
}) {
  const toneClass = tone && tone !== "neutral" ? `erp-badge--${tone}` : "";
  return (
    <span className={`erp-badge ${toneClass} ${className}`.trim()}>
      {dot && <span className="erp-badge__dot" />}
      <span>{children}</span>
    </span>
  );
}

export function StatusBadge({ status = "Preparado", className = "" }) {
  const preset = ERP_STATUS_MAP[status] || { tone: "neutral", label: status };
  return (
    <Badge tone={preset.tone} className={className}>
      {preset.label}
    </Badge>
  );
}

export default Badge;
