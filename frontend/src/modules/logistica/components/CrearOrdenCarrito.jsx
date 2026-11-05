import React from "react";
import { Plus, Minus, Trash2, Package, ArrowRight } from "lucide-react";
import { Button } from "../../../components/arc/button/button";
import { Badge } from "../../../components/arc/badge/badge";

export function CrearOrdenCarrito({
  consolidatedItems = [],
  productoMap,
  stockOrigenMap = new Map(),
  effectiveOrigenId,
  effectiveDestinoId,
  ubicMap,
  totalUnidades = 0,
  canProceed = false,
  onUpdateQuantity,
  onRemoveItem,
  onProceed,
}) {
  return (
    <div className="card p-4 stack gap-4 logistics-order-cart">
      <div className="row justify-between align-center">
        <div>
          <h3 className="text-base font-medium">Artículos seleccionados</h3>
          <span className="text-xs text-secondary">Renglones a consolidar en la orden</span>
        </div>
        <Badge tone="neutral" size="md">
          {consolidatedItems.length} producto(s)
        </Badge>
      </div>

      {consolidatedItems.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed text-center stack align-center gap-2 bg-surface-muted">
          <Package width={28} height={28} className="text-secondary" aria-hidden="true" />
          <span className="text-sm font-medium">El carrito está vacío</span>
          <p className="text-xs text-secondary">
            Seleccione necesidades sugeridas o agregue artículos desde el catálogo para preparar el abastecimiento.
          </p>
        </div>
      ) : (
        <div className="stack gap-3 erp-cart-scroll">
          {consolidatedItems.map((it) => {
            const prod = productoMap.get(it.productoId);
            const cdStock = stockOrigenMap.get(it.productoId)?.disponible || 0;

            return (
              <div
                key={it.productoId}
                className="p-3 rounded-xl border stack gap-2 bg-surface"
              >
                <div className="row justify-between align-start">
                  <div className="stack gap-0 flex-1 pr-2">
                    <span className="font-mono text-xs text-secondary">{prod?.codigo || `SKU-${it.productoId}`}</span>
                    <span className="text-sm font-medium text-foreground">{prod?.nombre || "Producto"}</span>
                    <div className="row gap-2 mt-1 align-center">
                      {it.origenNec?.length > 0 ? (
                        <Badge tone="info" size="sm">Necesidad #{it.origenNec.join(", #")}</Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">Carga manual</Badge>
                      )}
                      <span className="text-xs text-secondary">
                        Stock en CD: <strong className="text-success">{cdStock} un.</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.productoId)}
                    className="erp-btn erp-btn--ghost erp-btn--sm text-danger"
                    title="Quitar artículo del carrito"
                    aria-label={`Quitar ${prod?.nombre} del carrito`}
                  >
                    <Trash2 width={15} height={15} aria-hidden="true" />
                  </button>
                </div>

                <div className="row justify-between align-center pt-2 border-t">
                  <span className="text-xs text-secondary">Cantidad a solicitar:</span>
                  <div className="row gap-1 align-center">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(it.productoId, it.cantidad - 1)}
                      disabled={it.cantidad <= 1}
                      className="erp-btn erp-btn--secondary erp-btn--sm"
                      aria-label="Disminuir una unidad"
                    >
                      <Minus width={12} height={12} aria-hidden="true" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      max={cdStock}
                      value={it.cantidad}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          onUpdateQuantity(it.productoId, Math.min(val, cdStock));
                        }
                      }}
                      className="erp-input tabular-nums font-medium erp-qty-input"
                      aria-label="Cantidad de unidades"
                    />

                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(it.productoId, it.cantidad + 1)}
                      disabled={it.cantidad >= cdStock}
                      className="erp-btn erp-btn--secondary erp-btn--sm"
                      aria-label="Aumentar una unidad"
                    >
                      <Plus width={12} height={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-xl border bg-surface-muted stack gap-2">
        <div className="row justify-between text-xs text-secondary">
          <span>Renglones únicos:</span>
          <span className="font-medium text-foreground tabular-nums">{consolidatedItems.length}</span>
        </div>
        <div className="row justify-between text-xs text-secondary">
          <span>Unidades totales:</span>
          <span className="font-medium text-foreground tabular-nums">{totalUnidades} un.</span>
        </div>
        <div className="row justify-between text-xs text-secondary">
          <span>Origen abastecedor:</span>
          <span className="font-medium text-foreground">{ubicMap.get(Number(effectiveOrigenId)) || "CD Central"}</span>
        </div>
        <div className="row justify-between text-xs text-secondary">
          <span>Destino sucursal:</span>
          <span className="font-medium text-foreground">{ubicMap.get(Number(effectiveDestinoId)) || "Local receptor"}</span>
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        disabled={!canProceed}
        onClick={onProceed}
        className="w-full"
      >
        <span>Continuar a revisión ({consolidatedItems.length} ítems)</span>
        <ArrowRight width={16} height={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

export default CrearOrdenCarrito;
