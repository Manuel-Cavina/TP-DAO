import React, { useLayoutEffect, useRef } from "react";
import { Icon } from "./Icon";
import { Badge } from "./Badge";

/**
 * Arc UI Feedback & KPI Primitives (`frontend/src/shared/components/Feedback.jsx`)
 * Exports `Alert`, `EmptyState`, `Skeleton`, and `MetricCard`.
 */

export function Alert({
  tone = "info",
  title,
  description,
  action,
  onDismiss,
  className = "",
}) {
  return (
    <div
      role="alert"
      className={`erp-alert erp-alert--${tone} ${className}`.trim()}
    >
      <div className="erp-alert__main">
        <Icon
          name={tone === "success" ? "shield-check" : "alert-triangle"}
          size={17}
          className="erp-alert__icon"
        />
        <div className="erp-alert__text">
          {title && (
            <span className="font-medium">{title}</span>
          )}
          {description && (
            <span className="text-xs text-secondary">
              {description}
            </span>
          )}
        </div>
      </div>
      <div className="row align-center gap-2">
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar alerta"
            className="erp-btn erp-btn--ghost erp-btn--sm"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "package",
  title = "Sin registros para mostrar",
  description = "Ajusta los filtros activos o crea un nuevo registro para comenzar.",
  action,
  className = "",
}) {
  return (
    <div className={`erp-empty-state ${className}`.trim()}>
      <div className="erp-empty-state__icon">
        <Icon name={icon} size={20} />
      </div>
      <h3 className="erp-empty-state__title">
        {title}
      </h3>
      <p className="erp-empty-state__desc">{description}</p>
      {action && <div className="erp-empty-state__action">{action}</div>}
    </div>
  );
}

export function Skeleton({
  width,
  height,
  className = "",
}) {
  const skelRef = useRef(null);

  useLayoutEffect(() => {
    if (!skelRef.current) return;
    if (width !== undefined) {
      skelRef.current.style.setProperty("--skeleton-w", typeof width === "number" ? `${width}px` : width);
    }
    if (height !== undefined) {
      skelRef.current.style.setProperty("--skeleton-h", typeof height === "number" ? `${height}px` : height);
    }
  }, [width, height]);

  return (
    <span
      ref={skelRef}
      aria-hidden="true"
      className={`erp-skeleton ${className}`.trim()}
    />
  );
}

export function MetricCard({
  label,
  value,
  subtext,
  badgeText,
  badgeTone = "neutral",
  icon,
  className = "",
}) {
  return (
    <div className={`erp-metric-card ${className}`.trim()}>
      <div className="erp-metric-card__header">
        <span>{label}</span>
        {icon && <Icon name={icon} size={15} />}
      </div>
      <div className="erp-metric-card__value tabular-nums">{value}</div>
      {(badgeText || subtext) && (
        <div className="row justify-between align-center gap-2">
          {subtext && (
            <span className="text-xs text-muted">
              {subtext}
            </span>
          )}
          {badgeText && (
            <Badge tone={badgeTone} dot={false}>
              {badgeText}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
