import React, { useState, useEffect, useRef, useId } from "react";

/**
 * SearchableSelect (`frontend/src/shared/components/SearchableSelect.jsx`)
 * Selector de relaciones con búsqueda accesible por teclado (FR-039).
 * - Muestra hasta 7 opciones de forma directa; para conjuntos mayores provee búsqueda paginada de 20 filas.
 * - Soporta navegación por teclado: Flecha Abajo, Flecha Arriba, Enter para seleccionar, Escape para cerrar.
 * - Soporta búsqueda local o carga asíncrona mediante función `onSearch`.
 * - Cuenta con acción de limpiar (`clear`) cuando hay valor seleccionado y el control no está deshabilitado.
 */
export function SearchableSelect({
  value,
  onChange,
  options = [],
  onSearch,
  placeholder = "Buscar o seleccionar...",
  label,
  error,
  helpText,
  disabled = false,
  id,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);

  const hasValue = value !== undefined && value !== null && value !== "";
  // Determinar texto visible para el valor seleccionado
  const selectedOption = hasValue
    ? options.find((opt) => String(opt.value) === String(value))
    : null;

  useEffect(() => {
    let active = true;

    if (onSearch) {
      setIsLoading(true);
      Promise.resolve(onSearch(searchTerm))
        .then((results) => {
          if (active) {
            setFilteredOptions((results || []).slice(0, 20));
            setHighlightedIndex(-1);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setFilteredOptions([]);
            setIsLoading(false);
          }
        });
    } else {
      const q = searchTerm.toLowerCase().trim();
      const matched = options
        .filter((opt) => {
          if (!q) return true;
          const lbl = (opt.label || "").toLowerCase();
          const desc = (opt.description || opt.sublabel || "").toLowerCase();
          const code = (opt.code || "").toLowerCase();
          const cuit = (opt.cuit || "").toLowerCase();
          const val = String(opt.value || "").toLowerCase();
          return (
            lbl.includes(q) ||
            desc.includes(q) ||
            code.includes(q) ||
            cuit.includes(q) ||
            val.includes(q)
          );
        })
        .slice(0, 20);
      setFilteredOptions(matched);
      setHighlightedIndex(-1);
    }

    return () => {
      active = false;
    };
  }, [searchTerm, options, onSearch]);

  // Asegurar visibilidad de la opción seleccionada por teclado
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(`#${inputId}-opt-${highlightedIndex}`);
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex, inputId]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    if (onChange) onChange(option.value, option);
    setSearchTerm("");
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onChange) onChange("", null);
    setSearchTerm("");
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === "Enter") {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    }
  };

  const showClear = hasValue && !disabled;
  const activeOptionId =
    isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]
      ? `${inputId}-opt-${highlightedIndex}`
      : undefined;

  return (
    <div className="field" ref={containerRef}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <div className="search-select">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className={`input ${error ? "invalid" : ""} ${showClear ? "has-clear" : ""}`.trim()}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : searchTerm)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
        />

        {showClear && (
          <button
            type="button"
            className="search-select-clear"
            aria-label="Limpiar selección"
            title="Limpiar"
            tabIndex={0}
            onClick={handleClear}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        )}

        {isOpen && (
          <div
            ref={listboxRef}
            className="search-select-results"
            id={listboxId}
            role="listbox"
            aria-label={label || placeholder}
          >
            {isLoading ? (
              <div className="option muted" role="status">Cargando opciones...</div>
            ) : filteredOptions.length === 0 ? (
              <div className="option muted" role="status">No se encontraron resultados</div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    id={`${inputId}-opt-${index}`}
                    type="button"
                    className={`option ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span>
                      <strong>{opt.label}</strong>
                      {(opt.description || opt.sublabel) && (
                        <>
                          <br />
                          <span className="micro">{opt.description || opt.sublabel}</span>
                        </>
                      )}
                    </span>
                    {isSelected && <span aria-hidden="true">&#x2713;</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {helpText && !error && <span className="field-help">{helpText}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export default SearchableSelect;
