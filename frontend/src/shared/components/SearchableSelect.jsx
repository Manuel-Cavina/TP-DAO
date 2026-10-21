import React, { useState, useEffect, useRef, useId } from "react";

/**
 * SearchableSelect (`frontend/src/shared/components/SearchableSelect.jsx`)
 * Selector de relaciones con busqueda accesible por teclado (FR-039).
 * - Muestra hasta 7 opciones de forma directa; para conjuntos mayores provee busqueda paginada de 20 filas.
 * - Soporta navegacion por teclado: Flecha Abajo, Flecha Arriba, Enter para seleccionar, Escape para cerrar.
 * - Soporta busqueda local o carga asincrona mediante funcion `onSearch`.
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

  // Determinar texto visible para el valor seleccionado
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

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
          return lbl.includes(q) || desc.includes(q) || code.includes(q);
        })
        .slice(0, 20);
      setFilteredOptions(matched);
      setHighlightedIndex(-1);
    }

    return () => {
      active = false;
    };
  }, [searchTerm, options, onSearch]);

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
      setIsOpen(false);
    }
  };

  return (
    <div className="field" ref={containerRef}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <div className="search-select">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className={`input ${error ? "invalid" : ""}`}
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
        />

        {isOpen && (
          <div className="search-select-results" id={listboxId} role="listbox">
            {isLoading ? (
              <div className="option muted">Cargando opciones...</div>
            ) : filteredOptions.length === 0 ? (
              <div className="option muted">No se encontraron resultados</div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={opt.value}
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
                    {isSelected && <span>&#x2713;</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {helpText && !error && <span className="field-help">{helpText}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default SearchableSelect;
