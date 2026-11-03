import React, { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "../../../shared/components/Button";
import { Badge } from "../../../shared/components/Badge";
import { Alert, EmptyState } from "../../../shared/components/Feedback";
import { Icon } from "../../../shared/components/Icon";
import { useCategorias } from "../../catalogo";

export function PosCatalogo({
  productos = [],
  stockByProduct,
  cart = [],
  localNombre = "Punto de venta",
  loading = false,
  loadError = null,
  onAddToCart,
}) {
  const [search, setSearch] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("todas");
  const { categorias = [] } = useCategorias();
  const searchInputRef = useRef(null);

  // Atajo de teclado '/' para enfocar el buscador rápidamente
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Conteo de artículos por categoría
  const categoryCounts = useMemo(() => {
    const counts = { todas: productos.length };
    for (const p of productos) {
      const catKey = p.categoriaId ? String(p.categoriaId) : "sin_cat";
      counts[catKey] = (counts[catKey] || 0) + 1;
    }
    return counts;
  }, [productos]);

  const categoryTabs = useMemo(() => {
    const list = [{ id: "todas", label: "Todas", count: productos.length }];
    for (const cat of categorias) {
      const count = categoryCounts[String(cat.id)] || 0;
      list.push({ id: String(cat.id), label: cat.nombre, count });
    }
    return list;
  }, [categorias, productos.length, categoryCounts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return productos.filter((product) => {
      if (selectedCategoria !== "todas") {
        if (String(product.categoriaId) !== String(selectedCategoria)) {
          return false;
        }
      }
      if (!query) return true;
      return (
        String(product.codigo || "").toLowerCase().includes(query) ||
        String(product.nombre || "").toLowerCase().includes(query)
      );
    });
  }, [productos, selectedCategoria, search]);

  return (
    <div className="erp-section-card pos-column">
      {/* Cabecera de la sección */}
      <div className="row justify-between align-center mb-3">
        <div>
          <h3 className="text-md font-medium">1. Selección de artículos</h3>
          <p className="text-xs text-muted">
            Stock de: <strong className="text-foreground">{localNombre}</strong>
          </p>
        </div>
        <Badge tone="info" className="tabular-nums">
          {filteredProducts.length} disponibles
        </Badge>
      </div>

      {/* Buscador de artículos con atajo / */}
      <div className="erp-search-box mb-2">
        <Icon name="search" size={15} className="erp-search-box__icon" />
        <input
          ref={searchInputRef}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value.slice(0, 80))}
          placeholder="Buscar por código SKU o nombre (Presiona '/')"
          className="erp-search-box__input"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-xs text-muted hover:text-foreground px-2"
            aria-label="Limpiar búsqueda"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Filtro horizontal por categoría */}
      <div className="pos-categories-track">
        {categoryTabs.map((cat) => {
          const isSelected = selectedCategoria === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoria(cat.id)}
              className={`pos-category-chip ${isSelected ? "active" : ""}`}
            >
              {cat.label}{" "}
              <span className="opacity-75 tabular-nums">({cat.count})</span>
            </button>
          );
        })}
      </div>

      {/* Lista scrolleable interna de productos */}
      <div className="pos-catalog-scroll">
        {loadError ? (
          <Alert
            tone="danger"
            title="No se pudo cargar el catálogo"
            description={loadError.message}
          />
        ) : loading ? (
          <p className="text-xs text-muted py-8 text-center">
            Cargando productos...
          </p>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon="search"
            title="No hay productos disponibles"
            description={
              search
                ? "No hay coincidencias para la búsqueda."
                : "No hay artículos en esta categoría."
            }
          />
        ) : (
          filteredProducts.map((product) => {
            const stock = stockByProduct.get(Number(product.id)) || 0;
            const inCartItem = cart.find(
              (i) => Number(i.productoId) === Number(product.id)
            );
            const isOutOfStock = stock <= 0;
            const isLowStock = stock > 0 && stock <= 5;

            return (
              <div
                key={product.id}
                className="pos-product-item erp-callout row justify-between align-center"
              >
                <div className="stack gap-1">
                  <span className="font-medium text-xs text-foreground">
                    {product.nombre}
                  </span>
                  <div className="row align-center gap-2">
                    <span className="text-xs text-muted font-mono">
                      {product.codigo}
                    </span>
                    <span className="text-muted">·</span>
                    <Badge
                      tone={
                        isOutOfStock
                          ? "danger"
                          : isLowStock
                          ? "warning"
                          : "success"
                      }
                    >
                      {isOutOfStock
                        ? "Sin stock"
                        : isLowStock
                        ? `Últimas ${stock} un.`
                        : `Stock: ${stock} un.`}
                    </Badge>
                  </div>
                  <span className="text-xs text-foreground font-medium tabular-nums">
                    ${Number(product.precioVenta).toLocaleString("es-AR")}
                  </span>
                </div>

                <div className="row align-center gap-2">
                  {inCartItem && (
                    <Badge tone="info" className="tabular-nums">
                      {inCartItem.cantidad} en carrito
                    </Badge>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={inCartItem ? undefined : "plus"}
                    disabled={
                      isOutOfStock ||
                      (inCartItem && inCartItem.cantidad >= stock)
                    }
                    onClick={() => onAddToCart(product)}
                  >
                    {inCartItem ? "+1" : "Agregar"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
