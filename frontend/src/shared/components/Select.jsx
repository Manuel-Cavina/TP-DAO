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
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const optionRefs = useRef([]);

  // A visual value must always match the controlled value. Falling back to the
  // first option made required fields look selected before the user chose one.
  const selectedOption = options.find((opt) => opt.value === value) || null;

  useEffect(() => {
    function handleOutsideClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex((opt) => opt.value === value);
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  }, [open, options, value]);

  const selectOption = (opt) => {
    onChange?.(opt.value, opt);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      const direction = e.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(options.length - 1, (activeIndex < 0 ? 0 : activeIndex) + direction));
      setActiveIndex(nextIndex);
      setOpen(true);
      requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
    } else if (e.key === "Enter" && open && activeIndex >= 0) {
      e.preventDefault();
      selectOption(options[activeIndex]);
    }
  };

  const triggerLabel = label || ariaLabel || selectedOption?.label || placeholder;

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
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`erp-select-option ${isSelected ? "is-selected" : ""}`.trim()}
                ref={(element) => { optionRefs.current[options.indexOf(opt)] = element; }}
                onClick={() => selectOption(opt)}
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
