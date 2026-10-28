import React from "react";
import { Icon } from "./Icon";

/**
 * Arc UI SegmentedControl (`frontend/src/shared/components/SegmentedControl.jsx`)
 * Group selector with concentric inner pill (`--radius-xs: 6px` inside `--radius-control: 10px`)
 * and optional tabular counter badge.
 */

export function SegmentedControl({
  options = [],
  value,
  onChange,
  ariaLabel = "Selector de vista",
  className = "",
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`erp-segmented ${className}`.trim()}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`erp-segmented__item ${isActive ? "is-active" : ""}`.trim()}
            onClick={() => onChange && onChange(opt.value)}
          >
            {opt.icon && <Icon name={opt.icon} size={14} />}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span className="erp-segmented__count tabular-nums">
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
