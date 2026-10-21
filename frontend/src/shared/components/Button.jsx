import React, { useState } from "react";
import { Icon } from "./Icon";

/**
 * Arc UI Button, ButtonGroup & ConfirmMorph (`frontend/src/shared/components/Button.jsx`)
 * - Sentence case labels with clear action verbs (`Despachar remito`, `Registrar venta`).
 * - Weights 400 and 500 only.
 * - `ConfirmMorph` morphs a single destructive button into an inline Cancel / Confirm pill
 *   so destructive actions (`Rechazar bulto por merma`, `Eliminar producto`) never need a modal.
 */

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  iconLeft,
  iconRight,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const sizeClass =
    size === "sm" ? "erp-btn--sm" : size === "lg" ? "erp-btn--lg" : "";
  const variantClass = `erp-btn--${variant}`;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`erp-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {loading ? (
        <span
          className="erp-btn__spinner"
          aria-hidden="true"
        />
      ) : (
        iconLeft && <Icon name={iconLeft} size={15} />
      )}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
      {!loading && iconRight && <Icon name={iconRight} size={15} />}
    </button>
  );
}

export function ButtonGroup({ children, className = "" }) {
  return (
    <div role="group" className={`erp-btn-group ${className}`.trim()}>
      {children}
    </div>
  );
}

export function ConfirmMorph({
  triggerLabel = "Rechazar bulto por merma",
  confirmTitle = "¿Confirmar acción?",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  doneLabel = "Acción registrada",
  onConfirm,
}) {
  const [phase, setPhase] = useState("idle"); // "idle" | "confirming" | "done"

  if (phase === "done") {
    return (
      <span className="erp-badge erp-badge--danger">
        <span className="erp-badge__dot" />
        {doneLabel}
      </span>
    );
  }

  if (phase === "confirming") {
    return (
      <div className="arc-confirm-morph" role="group" aria-label={confirmTitle}>
        <span className="arc-confirm-morph__label">{confirmTitle}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPhase("idle")}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (onConfirm) onConfirm();
            setPhase("done");
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="danger"
      iconLeft="shield-off"
      onClick={() => setPhase("confirming")}
    >
      {triggerLabel}
    </Button>
  );
}

export default Button;
