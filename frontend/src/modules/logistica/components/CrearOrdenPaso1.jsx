import React from "react";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { StatusBadge } from "../../../shared/components/Badge";

export function CrearOrdenPaso1({
  locales = [],
  effectiveDestinoId,
  onDestinoChange,
  ubicMap,
  productoMap,
  pendingForDestino = [],
  selectedNecIds,
  onToggleNec,
  onSelectAllNec,
  loadingNec = false,
  productOptions = [],
  productoSearch,
  onProductoSearchChange,
  newProdId,
  onNewProdIdChange,
  newCantidad,
  onNewCantidadChange,
  onAddManualItem,
  manualError,
  manualItems = [],
  onRemoveManualItem,
  consolidatedItems = [],
  totalUnidades = 0,
  canProceedStep1 = false,
  onProceed,
}) {
  return (
    <div className="card p-5 stack gap-4">
      <div>
        <h2 className="text-lg">Paso 1: Necesidades y destino</h2>
        <p className="text-sm text-secondary">
          Seleccione la sucursal destino única. De acuerdo con las reglas de negocio (FR-008), una orden
          de reposición no puede combinar necesidades de distintas sucursales.
        </p>
      </div>

      <FormField label="Sucursal destino única (Local comercial activo)" required>
        <Select
          options={locales.map((l) => ({ value: String(l.id), label: `${l.nombre} (ID #${l.id})` }))}
          value={effectiveDestinoId}
          onChange={onDestinoChange}
          placeholder="Seleccionar sucursal destino"
        />
      </FormField>

      <div className="stack gap-2">
        <div className="row justify-between align-center">
          <span className="text-sm font-medium">
            Necesidades pendientes detectadas para {ubicMap.get(Number(effectiveDestinoId)) || "esta sucursal"} ({pendingForDestino.length})
          </span>
          {pendingForDestino.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onSelectAllNec}>
              {selectedNecIds.size === pendingForDestino.length ? "Deseleccionar todas" : "Seleccionar todas"}
            </Button>
          )}
        </div>

        {loadingNec ? (
          <p className="text-sm text-muted">Cargando necesidades pendientes...</p>
        ) : pendingForDestino.length === 0 ? (
          <div className="p-4 rounded bg-surface-muted text-sm text-secondary">
            No hay necesidades automáticas pendientes para {ubicMap.get(Number(effectiveDestinoId)) || "esta sucursal"}.
            Puede ingresar artículos manualmente en la sección siguiente.
          </div>
        ) : (
          <div className="stack gap-2">
            {pendingForDestino.map((nec) => {
              const checked = selectedNecIds.has(nec.id);
              const prod = productoMap.get(nec.productoId);
              return (
                <div
                  key={nec.id}
                  className={`row justify-between align-center p-3 rounded border cursor-pointer ${
                    checked ? "border-primary bg-primary-subtle" : "bg-surface"
                  }`}
                  onClick={() => onToggleNec(nec.id)}
                >
                  <div className="row gap-3 align-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onToggleNec(nec.id)}
                      aria-label={`Seleccionar necesidad ${nec.id}`}
                    />
                    <div>
                      <span className="font-mono text-xs text-secondary">Necesidad #{nec.id}</span>
                      <div className="text-sm font-medium">
                        {prod?.codigo || `SKU-${nec.productoId}`} · {prod?.nombre || "Sin detalle"}
                      </div>
                    </div>
                  </div>
                  <div className="row gap-3 align-center">
                    <span className="tabular-nums text-sm font-medium">{nec.cantidad} unidades</span>
                    <StatusBadge status={nec.estado} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Carga manual complementaria */}
      <div className="stack gap-2 pt-2 border-t">
        <span className="text-sm font-medium">Agregar renglón manual adicional</span>
        <div className="grid-2 gap-3">
          <TextInput
            label="Buscar producto en catálogo"
            value={productoSearch}
            onChange={(e) => onProductoSearchChange(e.target.value)}
            placeholder="Filtrar por SKU o nombre..."
          />
          <FormField label="Producto a abastecer">
            <Select
              options={productOptions}
              value={newProdId}
              onChange={onNewProdIdChange}
              placeholder="Seleccionar producto"
            />
          </FormField>
        </div>
        <div className="row gap-2 wrap align-end">
          <div className="w-36">
            <FormField label="Cantidad solicitada">
              <TextInput
                type="number"
                value={newCantidad}
                onChange={(e) => onNewCantidadChange(e.target.value)}
                placeholder="10"
                min="1"
              />
            </FormField>
          </div>
          <Button variant="secondary" onClick={onAddManualItem}>
            Agregar renglón
          </Button>
        </div>
        {manualError && <span className="text-xs text-danger">{manualError}</span>}

        {manualItems.length > 0 && (
          <div className="stack gap-1 pt-2">
            <span className="text-xs text-muted">Renglones manuales cargados:</span>
            {manualItems.map((it) => {
              const prod = productoMap.get(it.productoId);
              return (
                <div key={it.productoId} className="row justify-between align-center p-2 rounded bg-surface-muted text-sm">
                  <span>{prod?.codigo || `SKU-${it.productoId}`} · {prod?.nombre || "Sin detalle"} · {it.cantidad} unidades</span>
                  <Button variant="ghost" size="sm" onClick={() => onRemoveManualItem(it.productoId)}>
                    Quitar
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="row justify-between align-center pt-4 border-t">
        <span className="text-sm text-secondary">
          Total consolidado: <strong>{consolidatedItems.length}</strong> producto(s), <strong>{totalUnidades}</strong> unidades
        </span>
        <Button
          variant="primary"
          disabled={!canProceedStep1}
          onClick={onProceed}
          iconRight="arrow-right"
        >
          Continuar a selección de origen ({consolidatedItems.length} ítems)
        </Button>
      </div>
    </div>
  );
}

export default CrearOrdenPaso1;
