import React from "react";

/**
 * Arc UI Switch (`frontend/src/shared/components/Switch.jsx`)
 * Tactile toggle control with stretching spring thumb on `--control-track` / `--control-on`.
 */

export function Switch({
  checked = false,
  onChange,
  label,
  ariaLabel,
  description,
  disabled = false,
  className = "",
}) {
  const disabledClass = disabled ? "is-disabled" : "";

  return (
    <label
      className={`erp-switch-label ${disabledClass} ${className}`.trim()}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || ariaLabel || undefined}
        disabled={disabled}
        className={`erp-switch ${checked ? "is-checked" : ""}`.trim()}
        onClick={() => {
          if (!disabled && onChange) onChange(!checked);
        }}
      >
        <span className="erp-switch__thumb" />
      </button>
      {(label || description) && (
        <span className="stack">
          {label && (
            <span className="text-sm font-regular">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-muted">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export default Switch;
