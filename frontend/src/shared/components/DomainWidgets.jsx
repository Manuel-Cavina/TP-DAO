import React, { useLayoutEffect, useRef } from "react";
import { Icon } from "./Icon";
import { Badge, StatusBadge } from "./Badge";

/**
 * ERP AYA Domain Widgets (`frontend/src/shared/components/DomainWidgets.jsx`)
 * Implements the 3 GoF Patterns visually with Arc UI primitives:
 * 1. `Stepper` / `BultoStepper` -> State Pattern (`Preparado -> Precintado -> En_Transito -> Recibido -> Verificado / Rechazado`)
 * 2. `RadioCards` / `PaymentStrategySelector` -> Strategy Pattern (`Pago_Efectivo`, `Pago_Tarjeta`, `Pago_Transferencia`)
 * 3. `StockSplitBar` -> Observer Pattern (`cantidad_disponible` vs `cantidad_en_transito` + `nivel_minimo_existencia`)
 * 4. `PlotlyReportCard` -> Wrapper for `reportes` module charts
 * 5. `KpiTrendChip` & `LiveKpiCard` -> Live metrics with semantic trend indicators (FR-044)
 */

const BULTO_STEPS = [
  { key: "Preparado", label: "1. Preparado", desc: "Armado en CD Central" },
  { key: "Precintado", label: "2. Precintado", desc: "Faja de seguridad colocada" },
  { key: "En_Transito", label: "3. En tránsito", desc: "Despachado en Remito" },
  { key: "Recibido", label: "4. Recibido", desc: "Arribo físico al Local" },
  { key: "Verificado", label: "5. Verificado / Rechazado", desc: "Control de precinto final" },
];

export function Stepper({
  currentState = "En_Transito",
  precintoCode = "PRC-2026-0891",
  steps = BULTO_STEPS,
}) {
  const isRejected = currentState === "Rechazado";
  const activeIdx = isRejected
    ? 4
    : Math.max(
        0,
        steps.findIndex((s) => s.key === currentState)
      );

  return (
    <div className="erp-stepper-wrap">
      <div className="row justify-between align-center gap-2">
        <span className="text-xs text-secondary">
          Ciclo de vida del bulto (Patrón State) · Precinto{" "}
          <strong className="font-mono tabular-nums">{precintoCode}</strong>
        </span>
        <StatusBadge status={currentState} />
      </div>
      <div className="erp-stepper">
        {steps.map((step, idx) => {
          const isCurrent = idx === activeIdx;
          const isDone = idx < activeIdx || (currentState === "Verificado" && idx === 4);
          const stateClass =
            isRejected && idx === 4
              ? "is-rejected"
              : isCurrent
              ? "is-current"
              : isDone
              ? "is-done"
              : "";
          return (
            <div key={step.key} className={`erp-stepper__step ${stateClass}`.trim()}>
              <span className="erp-stepper__label">
                {isRejected && idx === 4 ? "5. Rechazado (merma)" : step.label}
              </span>
              <span className="text-xs text-muted">
                {step.desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const BultoStepper = Stepper;

const DEFAULT_PAYMENT_STRATEGIES = [
  {
    value: "Pago_Efectivo",
    title: "Pago en efectivo",
    subtitle: "Sin recargo · Calcula vuelto automático en caja",
    icon: "cash",
    badge: "0% recargo",
  },
  {
    value: "Pago_Tarjeta",
    title: "Pago con tarjeta",
    subtitle: "1, 3, 6 o 12 cuotas con coeficiente financiero",
    icon: "credit-card",
    badge: "1 a 12 cuotas",
  },
  {
    value: "Pago_Transferencia",
    title: "Pago por transferencia",
    subtitle: "Validación inmediata por CBU / alias y comprobante",
    icon: "transfer",
    badge: "Acreditación inmediata",
  },
];

export function RadioCards({
  options = DEFAULT_PAYMENT_STRATEGIES,
  value = "Pago_Efectivo",
  onChange,
}) {
  return (
    <div role="radiogroup" className="erp-radio-cards">
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`erp-radio-card ${isSelected ? "is-selected" : ""}`.trim()}
            onClick={() => onChange && onChange(opt.value)}
          >
            <div className="row justify-between align-center w-full">
              <Icon name={opt.icon || "credit-card"} size={16} />
              {opt.badge && (
                <Badge tone={isSelected ? "info" : "neutral"} dot={false}>
                  {opt.badge}
                </Badge>
              )}
            </div>
            <span className="erp-radio-card__title">
              {opt.title}
            </span>
            <span className="text-xs text-secondary">
              {opt.subtitle}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const PaymentStrategySelector = RadioCards;

export function StockSplitBar({
  disponible = 0,
  enTransito = 0,
  nivelMinimo = 10,
}) {
  const total = Math.max(disponible + enTransito, nivelMinimo * 2, 1);
  const pctDisp = Math.min(100, Math.round((disponible / total) * 100));
  const pctTrans = Math.min(100 - pctDisp, Math.round((enTransito / total) * 100));
  const isLow = disponible <= nivelMinimo;

  const dispRef = useRef(null);
  const transRef = useRef(null);

  useLayoutEffect(() => {
    if (dispRef.current) dispRef.current.style.setProperty("--pct", `${pctDisp}%`);
    if (transRef.current) transRef.current.style.setProperty("--pct", `${pctTrans}%`);
  }, [pctDisp, pctTrans]);

  return (
    <div className="erp-stock-wrap">
      <div className={`erp-stock-bar ${isLow ? "erp-stock-bar--low" : ""}`.trim()}>
        <span
          ref={dispRef}
          className="erp-stock-bar__available"
          title={`Disponible: ${disponible}`}
        />
        <span
          ref={transRef}
          className="erp-stock-bar__transit"
          title={`En tránsito: ${enTransito}`}
        />
      </div>
      <span
        className={`tabular-nums text-xs ${isLow ? "text-danger" : "text-muted"}`}
      >
        Disp: {disponible} · Tránsito: {enTransito} · Mín: {nivelMinimo}
      </span>
    </div>
  );
}

export function PlotlyReportCard({ title, subtitle, badgeText, children }) {
  return (
    <div className="erp-table-card erp-report-card">
      <div className="row justify-between align-center mb-4">
        <div>
          <h3 className="erp-card-title">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-secondary">
              {subtitle}
            </p>
          )}
        </div>
        {badgeText && <Badge tone="info">{badgeText}</Badge>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Indicador semántico de tendencia en tiempo real (FR-044).
 * Expresa ventana de comparación, dirección numérica y significado operacional
 * (favorable / desfavorable / neutral) en texto explícito, sin depender únicamente de color.
 */
export function KpiTrendChip({
  direction = "none",
  difference = "",
  period = "",
  meaning = "neutral",
  className = "",
}) {
  const isUp = direction === "up";
  const isDown = direction === "down";
  const arrow = isUp ? "\u2191" : isDown ? "\u2193" : "=";
  const chipTone =
    meaning === "favorable" ? "up" : meaning === "desfavorable" ? "down" : "";

  const meaningLabel =
    meaning === "favorable"
      ? "Favorable"
      : meaning === "desfavorable"
      ? "Desfavorable"
      : "Neutral";

  const directionWord = isUp
    ? "Aumento"
    : isDown
    ? "Disminución"
    : "Sin variación";

  const fullDescription = `${directionWord} ${difference} ${period} (${meaningLabel})`;

  return (
    <span
      className={`trend-chip ${chipTone} ${className}`.trim()}
      title={fullDescription}
      aria-label={fullDescription}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>
        {difference} {period}
      </span>
      <span className="trend-meaning">· {meaningLabel}</span>
    </span>
  );
}

/**
 * Tarjeta de KPI en vivo con soporte de tendencia semántica (FR-044).
 */
export function LiveKpiCard({
  label,
  value,
  subtext,
  badgeText,
  badgeTone = "neutral",
  trend,
  className = "",
  onClick,
}) {
  const badgeClass =
    badgeTone === "danger" || badgeTone === "bad"
      ? "badge bad"
      : badgeTone === "warning" || badgeTone === "warn"
      ? "badge warn"
      : badgeTone === "success" || badgeTone === "ok"
      ? "badge ok"
      : "badge info";

  return (
    <article
      className={`card metric ${onClick ? "interactive cursor-pointer" : ""} ${className}`.trim()}
      onClick={onClick}
    >
      <span className="micro">{label}</span>
      <strong className="tabular">{value}</strong>
      {badgeText && <span className={badgeClass}>{badgeText}</span>}
      {subtext && <span className="trend muted">{subtext}</span>}
      {trend && (
        <KpiTrendChip
          direction={trend.direction}
          difference={trend.difference}
          period={trend.period}
          meaning={trend.meaning}
        />
      )}
    </article>
  );
}
