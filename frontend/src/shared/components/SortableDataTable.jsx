import React, { useState, useMemo } from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { Alert, EmptyState, Skeleton } from "./Feedback";

/**
 * Arc UI SortableDataTable (`frontend/src/shared/components/SortableDataTable.jsx`)
 * Also exported as `DataTable` so every module can import either name.
 * - Sentence case headers (`font-weight: 500`, never uppercase)
 * - Column sorting with rotating `arrow-up` glyph and `--accent-subtle` column tint
 * - Multi-select checkboxes (`SelectBox`) with indeterminate state + footer selection bar
 * - Integrated `loading` (`Skeleton`), `empty` (`EmptyState`), and `error` (`Alert`) states
 * - Compact / Comfortable density support
 */

export function SortableDataTable({
  columns = [],
  data = [],
  rowKey = "id",
  selectable = true,
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  density = "comfortable",
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "No se encontraron resultados",
  emptyDescription = "Prueba limpiando los filtros activos o registra un nuevo ítem.",
  emptyAction,
  className = "",
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [internalSelected, setInternalSelected] = useState([]);

  const selectedKeys =
    controlledSelectedKeys !== undefined ? controlledSelectedKeys : internalSelected;

  const setSelected = (next) => {
    if (controlledSelectedKeys === undefined) setInternalSelected(next);
    if (onSelectionChange) onSelectionChange(next);
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA === valB) return 0;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      }
      return sortConfig.direction === "asc"
        ? String(valA ?? "").localeCompare(String(valB ?? ""))
        : String(valB ?? "").localeCompare(String(valA ?? ""));
    });
    return copy;
  }, [data, sortConfig]);

  const toggleSort = (colKey) => {
    setSortConfig((prev) => {
      if (prev.key !== colKey) return { key: colKey, direction: "asc" };
      return { key: colKey, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const allSelected =
    sortedData.length > 0 && selectedKeys.length === sortedData.length;
  const isIndeterminate =
    selectedKeys.length > 0 && selectedKeys.length < sortedData.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(sortedData.map((row) => row[rowKey]));
    }
  };

  const toggleRow = (id) => {
    if (selectedKeys.includes(id)) {
      setSelected(selectedKeys.filter((k) => k !== id));
    } else {
      setSelected([...selectedKeys, id]);
    }
  };

  if (error) {
    return (
      <Alert
        tone="danger"
        title={error.title || "Error al cargar los datos de la tabla"}
        description={error.description || error.message || String(error)}
        action={
          onRetry && (
            <Button variant="secondary" size="sm" iconLeft="refresh" onClick={onRetry}>
              Reintentar
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className={`erp-table-card ${className}`.trim()}>
      <div className="erp-table-scroll">
        <table
          className={`erp-table ${
            density === "compact" ? "erp-table--compact" : ""
          }`.trim()}
        >
          <thead>
            <tr>
              {selectable && (
                <th className="erp-table__col-check">
                  <button
                    type="button"
                    role="checkbox"
                    aria-label="Seleccionar todas las filas"
                    aria-checked={
                      allSelected ? "true" : isIndeterminate ? "mixed" : "false"
                    }
                    className="erp-table__checkbox"
                    onClick={toggleAll}
                  >
                    {allSelected && <Icon name="check" size={12} />}
                    {isIndeterminate && <span>-</span>}
                  </button>
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortConfig.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={`${col.align === "right" ? "align-right" : ""} ${
                      isSorted ? "is-sorted" : ""
                    }`.trim()}
                  >
                    {col.sortable !== false ? (
                      <button
                        type="button"
                        className="erp-table__sort-btn"
                        onClick={() => toggleSort(col.key)}
                      >
                        <span>{col.header}</span>
                        <Icon
                          name={
                            isSorted
                              ? sortConfig.direction === "asc"
                                ? "arrow-up"
                                : "arrow-down"
                              : "selector"
                          }
                          size={13}
                        />
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`}>
                  {selectable && (
                    <td>
                      <Skeleton width={16} height={16} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key}>
                      <Skeleton width="78%" height={14} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const id = row[rowKey];
                const isSelected = selectedKeys.includes(id);
                return (
                  <tr
                    key={id}
                    className={isSelected ? "is-selected" : ""}
                  >
                    {selectable && (
                      <td>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={`Seleccionar fila ${id}`}
                          className="erp-table__checkbox"
                          onClick={() => toggleRow(id)}
                        >
                          {isSelected && <Icon name="check" size={12} />}
                        </button>
                      </td>
                    )}
                    {columns.map((col) => {
                      const isSorted = sortConfig.key === col.key;
                      return (
                        <td
                          key={col.key}
                          className={`${
                            col.align === "right" ? "align-right" : ""
                          } ${col.mono ? "font-mono" : ""} ${
                            isSorted ? "is-sorted-col" : ""
                          }`.trim()}
                        >
                          {col.render ? col.render(row[col.key], row) : row[col.key]}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-table-footer">
        <span className="tabular-nums">
          {selectedKeys.length > 0
            ? `${selectedKeys.length} de ${sortedData.length} filas seleccionadas`
            : `Mostrando ${sortedData.length} registros`}
        </span>
        {selectedKeys.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected([])}
          >
            Limpiar selección
          </Button>
        )}
      </div>
    </div>
  );
}

export const DataTable = SortableDataTable;
export default SortableDataTable;
