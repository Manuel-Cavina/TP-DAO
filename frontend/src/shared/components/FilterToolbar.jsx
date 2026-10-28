import React, { useState } from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";

/**
 * Arc UI FilterToolbar (`frontend/src/shared/components/FilterToolbar.jsx`)
 * Composable search + two-step filter menu (Field -> Value) + removable filter chips + Clear all.
 */

export function FilterToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar por SKU, producto o código...",
  filters = [],
  availableFields = [],
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  rightSlot,
  className = "",
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeField, setActiveField] = useState(null);

  return (
    <div className={`erp-filter-toolbar ${className}`.trim()}>
      <div className="erp-filter-toolbar__left">
        <div className="erp-search-box">
          <Icon name="search" size={15} className="erp-search-box__icon" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="erp-search-box__input"
          />
        </div>

        {availableFields.length > 0 && (
          <div
            className="relative"
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenuOpen(false);
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              iconLeft="filter"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => {
                setMenuOpen((prev) => !prev);
                setActiveField(null);
              }}
            >
              Agregar filtro
            </Button>

            {menuOpen && (
              <div
                className="erp-select-popover erp-select-popover--filter"
                role="menu"
                aria-label="Campos de filtro"
              >
                {!activeField ? (
                  availableFields.map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      className="erp-select-option"
                      onClick={() => setActiveField(field)}
                    >
                      <span>{field.label}</span>
                      <Icon name="selector" size={13} />
                    </button>
                  ))
                ) : (
                  <>
                    <div className="erp-filter-toolbar__field-label">
                      {activeField.label}
                    </div>
                    {(activeField.values || []).map((val) => (
                      <button
                        key={val}
                        type="button"
                        className="erp-select-option"
                        onClick={() => {
                          if (onAddFilter) {
                            onAddFilter({
                              key: activeField.key,
                              label: activeField.label,
                              value: val,
                            });
                          }
                          setMenuOpen(false);
                          setActiveField(null);
                        }}
                      >
                        <span>{val}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {filters.map((chip, idx) => (
          <span key={`${chip.key}-${chip.value}-${idx}`} className="erp-filter-chip">
            <span>{chip.label}:</span>
            <span className="erp-filter-chip__value">{chip.value}</span>
            <button
              type="button"
              aria-label={`Quitar filtro ${chip.label}`}
              className="erp-filter-chip__remove"
              onClick={() => onRemoveFilter && onRemoveFilter(chip, idx)}
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}

        {(filters.length > 0 || searchValue) && onClearAll && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {rightSlot && <div className="erp-filter-toolbar__right">{rightSlot}</div>}
    </div>
  );
}

export default FilterToolbar;
