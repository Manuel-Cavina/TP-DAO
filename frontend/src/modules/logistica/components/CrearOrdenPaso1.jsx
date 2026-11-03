import React, { useState, useMemo } from "react";
import { Plus, Zap, AlertTriangle, Check, Warehouse, Store, RotateCcw } from "lucide-react";
import { Button } from "../../../components/arc/button/button";
import { Badge } from "../../../components/arc/badge/badge";
import { SearchField } from "../../../components/arc/search-field/search-field";
import { EmptyState } from "../../../components/arc/empty-state/empty-state";
import { FormField } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { CrearOrdenCarrito } from "./CrearOrdenCarrito";

export function CrearOrdenPaso1({
  locales = [],
  centrosDistribucion = [],
  effectiveDestinoId,
  onDestinoChange,
  effectiveOrigenId,
  onOrigenChange,
  ubicMap,
  productoMap,
  categorias = [],
  productos = [],
  pendingForDestino = [],
  selectedNecIds = new Set(),
  onToggleNec,
  onSelectAllNec,
  stockDestinoMap = new Map(),
  stockOrigenMap = new Map(),
  loadingStock = false,
  consolidatedItems = [],
  totalUnidades = 0,
  onAddItem,
  onUpdateQuantity,
  onRemoveItem,
  canProceedStep1 = false,
  onProceed,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoriaId, setSelectedCategoriaId] = useState("");
  const [localInputQuantities, setLocalInputQuantities] = useState({});

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const catId = selectedCategoriaId ? Number(selectedCategoriaId) : null;

    return productos.filter((prod) => {
      if (catId && prod.categoriaId !== catId) {
        return false;
      }
      if (!q) return true;
      const matchCodigo = prod.codigo?.toLowerCase().includes(q);
      const matchNombre = prod.nombre?.toLowerCase().includes(q);
      return matchCodigo || matchNombre;
    });
  }, [productos, searchQuery, selectedCategoriaId]);

  // Artículos con stock próximo al mínimo que tienen disponibilidad en CD y no están en el carrito
  const nearMinStockProducts = useMemo(() => {
    if (!effectiveDestinoId) return [];
    return productos.filter((prod) => {
      const stock = stockDestinoMap.get(prod.id);
      if (!stock) return false;
      const min = stock.nivelMinimo || prod.nivelMinimo || 1;
      return stock.disponible <= Math.ceil(min * 1.06);
    });
  }, [productos, stockDestinoMap, effectiveDestinoId]);

  // Filtrado de sugerencias: solo las NO agregadas al carrito y con stock disponible en CD
  const pendingNeedsToShow = useMemo(() => {
    return pendingForDestino.filter(
      (nec) => !selectedNecIds.has(nec.id) && (stockOrigenMap.get(nec.productoId)?.disponible || 0) > 0
    );
  }, [pendingForDestino, selectedNecIds, stockOrigenMap]);

  const nearMinToShow = useMemo(() => {
    return nearMinStockProducts.filter(
      (prod) =>
        !consolidatedItems.some((it) => it.productoId === prod.id) &&
        (stockOrigenMap.get(prod.id)?.disponible || 0) > 0
    );
  }, [nearMinStockProducts, consolidatedItems, stockOrigenMap]);

  const categoryOptions = useMemo(() => {
    const counts = new Map();
    for (const prod of productos) {
      if (prod.categoriaId) {
        counts.set(prod.categoriaId, (counts.get(prod.categoriaId) || 0) + 1);
      }
    }
    return [
      { id: "", nombre: "Todas las categorías", count: productos.length },
      ...categorias.map((cat) => ({
        id: String(cat.id),
        nombre: cat.nombre,
        count: counts.get(cat.id) || 0,
      })),
    ];
  }, [categorias, productos]);

  const handleInputChange = (prodId, rawValue) => {
    setLocalInputQuantities((prev) => ({
      ...prev,
      [prodId]: rawValue,
    }));
  };

  const handleInputBlur = (prodId, maxStock) => {
    const raw = localInputQuantities[prodId];
    if (raw === undefined) return;
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < 1) {
      setLocalInputQuantities((prev) => ({ ...prev, [prodId]: "1" }));
    } else if (num > maxStock) {
      setLocalInputQuantities((prev) => ({ ...prev, [prodId]: String(maxStock) }));
    }
  };

  const handleCatalogAdd = (prodId) => {
    const cdStock = stockOrigenMap.get(prodId)?.disponible || 0;
    if (cdStock <= 0) return;
    const raw = localInputQuantities[prodId];
    const qty = parseInt(raw, 10) || 1;
    if (qty < 1 || qty > cdStock) return;
    onAddItem(prodId, qty);
    setLocalInputQuantities((prev) => ({ ...prev, [prodId]: "1" }));
  };

  const selectedCdObj = centrosDistribucion.find((cd) => String(cd.id) === String(effectiveOrigenId));

  return (
    <div className="stack gap-5">
      <div className="card p-5 stack gap-4">
        <div>
          <h2 className="text-lg font-medium">Paso 1: Configuración de ruta y artículos</h2>
          <p className="text-sm text-secondary">
            Seleccione la sucursal receptora y la casa central abastecedora. El stock disponible se verifica en tiempo real contra el Centro de Distribución emisor.
          </p>
        </div>

        <div className="grid-2 gap-4">
          <FormField label="Sucursal destino única (Local comercial receptor)" required>
            <Select
              options={locales.map((l) => ({ value: String(l.id), label: `${l.nombre} (ID #${l.id})` }))}
              value={effectiveDestinoId}
              onChange={onDestinoChange}
              placeholder="Seleccionar sucursal destino"
              iconLeft={<Store width={16} height={16} className="text-secondary" />}
            />
          </FormField>

          <FormField label="Casa central de reposición (CD abastecedor de origen)" required>
            <Select
              options={centrosDistribucion.map((cd) => ({
                value: String(cd.id),
                label: `${cd.nombre} (ID #${cd.id} · CD Activo)`,
              }))}
              value={effectiveOrigenId}
              onChange={onOrigenChange}
              placeholder="Seleccionar CD abastecedor"
              iconLeft={<Warehouse width={16} height={16} className="text-secondary" />}
            />
          </FormField>
        </div>

        {selectedCdObj && (
          <div className="row justify-between align-center p-3 rounded-lg bg-surface-muted text-xs text-secondary border">
            <div className="row gap-2 align-center">
              <Badge tone="success" size="sm" dot>CD abastecedor activo</Badge>
              <span>{selectedCdObj.nombre} abastece a {ubicMap.get(Number(effectiveDestinoId)) || "la sucursal seleccionada"}</span>
            </div>
            {loadingStock && <span className="text-muted">Sincronizando saldos de inventario...</span>}
          </div>
        )}
      </div>

      <div className="erp-split-grid">
        <div className="stack gap-4">
          
          {/* 1. Sugerencias prioritarias de reposición (Arriba en la columna izquierda) */}
          <div className="card p-4 stack gap-3">
            <div className="row justify-between align-center">
              <div className="row gap-2 align-center">
                <Zap width={16} height={16} className="text-accent" aria-hidden="true" />
                <span className="text-sm font-medium">Sugerencias prioritarias de reposición</span>
              </div>
              {pendingNeedsToShow.length > 0 && (
                <Button variant="ghost" size="sm" onClick={onSelectAllNec}>
                  <span>Agregar todas</span>
                </Button>
              )}
            </div>

            {pendingNeedsToShow.length === 0 && nearMinToShow.length === 0 ? (
              <div className="row gap-2 align-center p-3 rounded-lg bg-surface-muted text-xs text-secondary border">
                <Check width={16} height={16} className="text-success" aria-hidden="true" />
                <span>Todas las necesidades pendientes y alertas de stock han sido incorporadas al carrito.</span>
              </div>
            ) : (
              <div className="stack gap-3">
                {pendingNeedsToShow.length > 0 && (
                  <div className="stack gap-2">
                    <span className="text-xs text-muted">Necesidades automáticas pendientes ({pendingNeedsToShow.length}):</span>
                    {pendingNeedsToShow.map((nec) => {
                      const prod = productoMap.get(nec.productoId);
                      const cdStock = stockOrigenMap.get(nec.productoId)?.disponible || 0;

                      return (
                        <div
                          key={nec.id}
                          className="row justify-between align-center p-3 rounded-lg border bg-surface transition-colors"
                        >
                          <div className="stack gap-0">
                            <div className="row gap-2 align-center">
                              <span className="font-mono text-xs text-secondary">SKU-{prod?.codigo || nec.productoId}</span>
                              <Badge tone="info" size="sm">Necesidad #{nec.id}</Badge>
                            </div>
                            <span className="text-sm font-medium">{prod?.nombre || "Sin detalle"}</span>
                            <div className="row gap-3 text-xs text-secondary mt-1">
                              <span>Requerido: <strong>{nec.cantidad} un.</strong></span>
                              <span>Disponible en CD: <strong className="text-success">{cdStock} un.</strong></span>
                            </div>
                          </div>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onToggleNec(nec.id)}
                          >
                            <Plus width={14} height={14} aria-hidden="true" />
                            <span>Agregar ({nec.cantidad} un.)</span>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {nearMinToShow.length > 0 && (
                  <div className="stack gap-2 pt-2 border-t">
                    <div className="row gap-2 align-center">
                      <AlertTriangle width={14} height={14} className="text-warning" aria-hidden="true" />
                      <span className="text-xs text-muted">Artículos con stock crítico o próximo al mínimo ({nearMinToShow.length}):</span>
                    </div>
                    <div className="stack gap-2">
                      {nearMinToShow.slice(0, 3).map((prod) => {
                        const localStock = stockDestinoMap.get(prod.id)?.disponible || 0;
                        const minStock = stockDestinoMap.get(prod.id)?.nivelMinimo || prod.nivelMinimo || 1;
                        const cdStock = stockOrigenMap.get(prod.id)?.disponible || 0;
                        const sugerido = Math.min(cdStock, Math.max(1, minStock * 2 - localStock));

                        return (
                          <div key={prod.id} className="row justify-between align-center p-3 rounded-lg border bg-surface">
                            <div className="stack gap-0">
                              <span className="font-mono text-xs text-secondary">{prod.codigo} · {prod.nombre}</span>
                              <div className="row gap-3 text-xs text-secondary mt-1">
                                <span>Stock local: <strong className="text-warning">{localStock} un.</strong> (Mín: {minStock})</span>
                                <span>Stock en CD: <strong className="text-success">{cdStock} un.</strong></span>
                              </div>
                            </div>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onAddItem(prod.id, sugerido)}
                            >
                              <Plus width={14} height={14} aria-hidden="true" />
                              <span>Sugerir {sugerido} un.</span>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Búsqueda de artículos en catálogo y filtros de categoría (Debajo de las sugerencias) */}
          <div className="card p-4 stack gap-3">
            <SearchField
              label="Búsqueda de artículos en catálogo"
              placeholder="Buscar por código SKU, nombre o descripción..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />

            <div className="stack gap-1">
              <span className="text-xs font-medium text-secondary">Filtrar por categoría</span>
              <div className="row wrap gap-2">
                {categoryOptions.map((cat) => {
                  const isSelected = selectedCategoriaId === cat.id;
                  return (
                    <button
                      key={cat.id || "all"}
                      type="button"
                      onClick={() => setSelectedCategoriaId(cat.id)}
                      className={`erp-btn erp-btn--sm erp-category-btn ${
                        isSelected ? "erp-btn--primary" : "erp-btn--ghost"
                      }`}
                    >
                      <span>{cat.nombre}</span>
                      <span className="text-xs opacity-75">({cat.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Listado explorador de productos */}
          <div className="card p-4 stack gap-3">
            <div className="row justify-between align-center">
              <span className="text-sm font-medium">Catálogo disponible para reposición</span>
              <span className="text-xs text-secondary">
                Mostrando {filteredProducts.length} artículo(s)
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState
                title="No se encontraron artículos"
                description="Intente modificar el criterio de búsqueda o el filtro de categorías."
                action={
                  <Button variant="secondary" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategoriaId(""); }}>
                    <RotateCcw width={14} height={14} aria-hidden="true" />
                    <span>Restablecer filtros</span>
                  </Button>
                }
              />
            ) : (
              <div className="stack gap-2">
                {filteredProducts.map((prod) => {
                  const localStock = stockDestinoMap.get(prod.id)?.disponible || 0;
                  const minStock = stockDestinoMap.get(prod.id)?.nivelMinimo || prod.nivelMinimo || 1;
                  const cdStock = stockOrigenMap.get(prod.id)?.disponible || 0;
                  const isSinStockCd = cdStock <= 0;

                  const rawVal = localInputQuantities[prod.id];
                  const valStr = rawVal !== undefined ? rawVal : "1";
                  const numVal = parseInt(valStr, 10);
                  const isExceeded = !isNaN(numVal) && numVal > cdStock;
                  const isInvalid = !valStr || isNaN(numVal) || numVal < 1 || isExceeded;
                  const canAdd = !isSinStockCd && !isInvalid;

                  const cartItem = consolidatedItems.find((it) => it.productoId === prod.id);

                  return (
                    <div key={prod.id} className="row justify-between align-center p-3 rounded-lg border bg-surface hover:border-strong transition-colors">
                      <div className="stack gap-1 flex-1 pr-3">
                        <div className="row gap-2 align-center">
                          <span className="font-mono text-xs text-secondary">{prod.codigo}</span>
                          <Badge tone="neutral" size="sm">
                            {categorias.find((c) => c.id === prod.categoriaId)?.nombre || "General"}
                          </Badge>
                          {cartItem && (
                            <Badge tone="info" size="sm" dot>
                              En carrito: {cartItem.cantidad} un.
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-medium">{prod.nombre}</span>
                        <div className="row gap-4 text-xs text-secondary">
                          <span>
                            Stock en destino: <strong className={localStock <= minStock ? "text-warning" : ""}>{localStock} un.</strong> (Mín: {minStock})
                          </span>
                          <span>
                            Stock en CD Central:{" "}
                            <strong className={isSinStockCd ? "text-danger" : "text-success"}>
                              {cdStock} un. {isSinStockCd ? "(Agotado)" : ""}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="row gap-2 align-center">
                        <input
                          type="number"
                          min="1"
                          max={cdStock > 0 ? cdStock : 1}
                          value={valStr}
                          disabled={isSinStockCd}
                          onChange={(e) => handleInputChange(prod.id, e.target.value)}
                          onBlur={() => handleInputBlur(prod.id, cdStock)}
                          className={`erp-input tabular-nums erp-qty-input ${isExceeded ? "border-danger text-danger" : ""}`}
                          aria-label={`Cantidad para ${prod.nombre}`}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canAdd}
                          onClick={() => handleCatalogAdd(prod.id)}
                        >
                          <Plus width={14} height={14} aria-hidden="true" />
                          <span>{isSinStockCd ? "Sin stock" : isExceeded ? "Supera stock" : "Agregar"}</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <CrearOrdenCarrito
            consolidatedItems={consolidatedItems}
            productoMap={productoMap}
            stockOrigenMap={stockOrigenMap}
            effectiveOrigenId={effectiveOrigenId}
            effectiveDestinoId={effectiveDestinoId}
            ubicMap={ubicMap}
            totalUnidades={totalUnidades}
            canProceed={canProceedStep1}
            onUpdateQuantity={onUpdateQuantity}
            onRemoveItem={onRemoveItem}
            onProceed={onProceed}
          />
        </div>
      </div>
    </div>
  );
}

export default CrearOrdenPaso1;
