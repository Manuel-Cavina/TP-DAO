import React from "react";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";

/**
 * EmpaquetadoForm:
 * Formulario para crear un nuevo bulto en preparacion a partir de items pendientes de la orden.
 */
export function EmpaquetadoForm({
  itemsPendientes = [],
  selectedProdId,
  onSelectProdId,
  cantidadBulto,
  onChangeCantidad,
  onSubmit,
  loading = false,
  disabled = false,
  error = "",
  isPrimaryAction = false,
}) {
  const articulosDisponibles = itemsPendientes.filter((it) => it.restante > 0);
  const todosCompletos = itemsPendientes.length > 0 && articulosDisponibles.length === 0;

  return (
    <div className="card p-4 stack gap-3">
      <div className="row justify-between align-center">
        <h2 className="text-md font-medium">Artículos de la orden por empaquetar</h2>
        <span className="text-xs text-secondary">
          {itemsPendientes.reduce((s, it) => s + it.empaquetado, 0)} de{" "}
          {itemsPendientes.reduce((s, it) => s + it.solicitado, 0)} u.
        </span>
      </div>

      <div className="stack gap-2">
        {itemsPendientes.map((it) => (
          <div
            key={it.productoId}
            className="row justify-between align-center p-3 rounded bg-surface-muted text-sm"
          >
            <div>
              <span className="font-mono">Producto #{it.productoId}</span>
              <span className="text-xs text-secondary block">
                Solicitado: {it.solicitado} u. · Empaquetado: {it.empaquetado} u.
              </span>
            </div>
            <span
              className={`tabular-nums font-medium ${
                it.restante === 0 ? "text-success" : "text-primary"
              }`}
            >
              {it.restante === 0 ? "Completado" : `${it.restante} u. pendientes`}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-2 rounded bg-danger-subtle text-danger text-xs">{error}</div>
      )}

      <form onSubmit={onSubmit} className="stack gap-3 pt-3 border-t">
        <span className="text-sm font-medium">Armar nuevo bulto</span>
        <div className="grid-2 gap-2">
          <FormField label="Artículo">
            <Select
              options={articulosDisponibles.map((it) => ({
                value: String(it.productoId),
                label: `Producto #${it.productoId} (${it.restante} rest.)`,
              }))}
              value={selectedProdId || (articulosDisponibles[0]?.productoId ? String(articulosDisponibles[0].productoId) : "")}
              onChange={onSelectProdId}
              placeholder="Elegir producto"
            />
          </FormField>
          <FormField label="Cantidad a colocar">
            <TextInput
              type="number"
              min="1"
              placeholder="Cantidad"
              value={cantidadBulto}
              onChange={onChangeCantidad}
            />
          </FormField>
        </div>

        <Button
          variant={isPrimaryAction ? "primary" : "secondary"}
          iconLeft="package"
          type="submit"
          loading={loading}
          loadingLabel="Armando bulto..."
          disabled={todosCompletos || disabled}
        >
          Crear bulto en preparación
        </Button>
      </form>
    </div>
  );
}

export default EmpaquetadoForm;
