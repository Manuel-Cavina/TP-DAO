import React, { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon";

/**
 * Arc UI Select (`frontend/src/shared/components/Select.jsx`)
 * Custom single-select dropdown with:
 * - Sentence case label and optional description
 * - Selector chevron (`⇅`) on the trigger
 * - Floating popover (`--shadow-floating`, concentric `--radius-panel: 16px` outer / `--radius-control: 10px` inner)
 * - Active check indicator (`✓`) on the selected option
 */

export function Select({
  label,
  ariaLabel,
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar opción",
  iconLeft,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0] || null;

  useEffect(() => {
    function handleOutsideClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      }
    }
  };

  const triggerLabel = label || ariaLabel || (selectedOption ? selectedOption.label : placeholder);

  return (
    <div
      ref={wrapRef}
      className={`erp-select-wrap ${className}`.trim()}
      onKeyDown={handleKeyDown}
    >
      {label && <span className="erp-field-label">{label}</span>}
      <button
        type="button"
        className="erp-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="erp-select-trigger__left">
          {(selectedOption?.icon || iconLeft) && (
            <Icon name={selectedOption?.icon || iconLeft} size={15} />
          )}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <Icon
          name="selector"
          size={15}
          className="erp-select-trigger__chevron"
        />
      </button>

      {open && (
        <div
          className="erp-select-popover"
          role="listbox"
          aria-label={triggerLabel}
        >
          {options.map((opt) => {
            const isSelected = opt.value === (selectedOption && selectedOption.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`erp-select-option ${isSelected ? "is-selected" : ""}`.trim()}
                onClick={() => {
                  if (onChange) onChange(opt.value, opt);
                  setOpen(false);
                }}
              >
                <span className="erp-select-option__content">
                  {opt.icon && <Icon name={opt.icon} size={14} />}
                  <span>
                    <span className="block">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-xs text-muted">
                        {opt.description}
                      </span>
                    )}
                  </span>
                </span>
                {isSelected && (
                  <Icon
                    name="check"
                    size={15}
                    className="erp-select-option__check"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Select;
