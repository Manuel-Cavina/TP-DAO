import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { PaymentStrategySelector } from "../../../shared/components/DomainWidgets";
import { TextInput, NumberInput } from "../../../shared/components/FormControls";
import { Badge } from "../../../shared/components/Badge";
import { Alert, EmptyState } from "../../../shared/components/Feedback";
import { Icon } from "../../../shared/components/Icon";
import { mapCheckoutToDTO } from "../mappers/ventasMappers";

const CUOTAS_RECARGOS = { 1: 0, 3: 0.1, 6: 0.2, 12: 0.35 };

export function PosTerminal({
  productos = [],
  stocks = [],
  localId,
  onCheckout,
  pending = false,
  loading = false,
  loadError = null,
}) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [strategy, setStrategy] = useState("Pago_Efectivo");
  const [cuotas, setCuotas] = useState(1);
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [cbuOAlias, setCbuOAlias] = useState("");
  const [codigoTransaccion, setCodigoTransaccion] = useState("");
  const [validationError, setValidationError] = useState("");
  const stockByProduct = useMemo(
    () => new Map(stocks.map((stock) => [Number(stock.productoId), Number(stock.disponible) || 0])),
    [stocks]
  );

  useEffect(() => {
    setCart([]);
    setValidationError("");
  }, [localId]);

  const addToCart = (product) => {
    const available = stockByProduct.get(Number(product.id)) || 0;
    const selected = cart.find((item) => Number(item.productoId) === Number(product.id))?.cantidad || 0;
    if (selected >= available) {
      setValidationError(`No hay más stock disponible de ${product.nombre} en este local.`);
      return;
    }
    setCart((current) => {
      const index = current.findIndex((item) => Number(item.productoId) === Number(product.id));
      if (index < 0) {
        return [
          ...current,
          {
            productoId: product.id,
            codigo: product.codigo,
            nombre: product.nombre,
            precio: Number(product.precioVenta) || 0,
            cantidad: 1,
          },
        ];
      }
      return current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, cantidad: item.cantidad + 1 } : item
      );
    });
    setValidationError("");
  };

  const updateQuantity = (productoId, delta, max = 100_000) => {
    setCart((current) =>
      current
        .map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: Math.min(max, item.cantidad + delta) }
            : item
        )
        .filter((item) => item.cantidad > 0)
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const recargoPct = strategy === "Pago_Tarjeta" ? CUOTAS_RECARGOS[cuotas] || 0 : 0;
  const recargo = Math.round(subtotal * recargoPct * 100) / 100;
  const total = subtotal + recargo;
  const cash = Number(efectivoRecibido);
  const vuelto = strategy === "Pago_Efectivo" && cash > total ? cash - total : 0;

  const checkoutForm = {
    localId,
    medioPago: strategy,
    cuotas,
    efectivoRecibido,
    numeroTarjeta,
    cbuOAlias,
    codigoTransaccion,
    total,
    items: cart,
  };

  const handleCobro = async () => {
    try {
      mapCheckoutToDTO(checkoutForm);
      setValidationError("");
    } catch (error) {
      setValidationError(error.message);
      return;
    }
    const result = await onCheckout(checkoutForm);
    if (result?.ok) {
      setCart([]);
      setEfectivoRecibido("");
      setNumeroTarjeta("");
      setCbuOAlias("");
      setCodigoTransaccion("");
    } else if (result?.error?.message) {
      setValidationError(result.error.message);
    }
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return productos;
    return productos.filter(
      (product) =>
        String(product.codigo || "").toLowerCase().includes(query) ||
        String(product.nombre || "").toLowerCase().includes(query)
    );
  }, [productos, search]);

  return (
    <div className="grid-2 gap-4">
      <div className="erp-section-card stack gap-3">
        <div className="row justify-between align-center">
          <h3 className="text-md font-medium">1. Selección de artículos</h3>
          <Badge tone="info">{filteredProducts.length} disponibles</Badge>
        </div>

        <div className="erp-search-box">
          <Icon name="search" size={15} className="erp-search-box__icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value.slice(0, 80))}
            placeholder="Buscar por código SKU o nombre"
            className="erp-search-box__input"
          />
        </div>

        {loadError ? (
          <Alert
            tone="danger"
            title="No se pudo cargar el catálogo"
            description={loadError.message}
          />
        ) : loading ? (
          <p className="text-xs text-muted py-8 text-center">Cargando productos...</p>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon="search"
            title="No hay productos disponibles"
            description={search ? "No hay coincidencias para la búsqueda." : "El catálogo activo está vacío."}
          />
        ) : (
          <div className="stack gap-2 overflow-y-auto max-h-96">
            {filteredProducts.slice(0, 30).map((product) => (
              <div key={product.id} className="erp-callout row justify-between align-center">
                <div className="stack gap-1">
                  <span className="font-medium text-xs">{product.nombre}</span>
                  <span className="text-xs text-muted tabular-nums">
                    Stock local: {stockByProduct.get(Number(product.id)) || 0}
                  </span>
                  <span className="text-xs text-muted font-mono">
                    {product.codigo} · ${Number(product.precioVenta).toLocaleString("es-AR")}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft="plus"
                  disabled={(stockByProduct.get(Number(product.id)) || 0) <= 0}
                  onClick={() => addToCart(product)}
                >
                  Agregar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="erp-section-card stack gap-4">
        <div className="row justify-between align-center">
          <h3 className="text-md font-medium">2. Carrito y cobro</h3>
          <span className="text-xs text-muted tabular-nums">{cart.length} líneas</span>
        </div>

        {cart.length === 0 ? (
          <EmptyState
            icon="package"
            title="Carrito vacío"
            description="Selecciona productos para comenzar la venta."
          />
        ) : (
          <div className="stack gap-2">
            {cart.map((item) => (
              <div key={item.productoId} className="row justify-between align-center erp-field">
                <div className="stack gap-1">
                  <span className="text-xs font-medium">{item.nombre}</span>
                  <span className="text-xs text-muted tabular-nums">
                    ${item.precio.toLocaleString("es-AR")} c/u
                  </span>
                </div>
                <div className="row align-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.productoId, -1)}>
                    -
                  </Button>
                  <span className="tabular-nums font-medium text-xs">{item.cantidad}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={item.cantidad >= (stockByProduct.get(Number(item.productoId)) || 0)}
                    onClick={() => updateQuantity(
                      item.productoId,
                      1,
                      stockByProduct.get(Number(item.productoId)) || 0
                    )}
                  >
                    +
                  </Button>
                  <span className="tabular-nums font-medium text-xs w-16 text-right">
                    ${(item.precio * item.cantidad).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="stack gap-3 pt-3 border-t">
          <PaymentStrategySelector
            value={strategy}
            onChange={(value) => {
              setStrategy(value);
              setValidationError("");
            }}
          />

          {strategy === "Pago_Tarjeta" && (
            <div className="stack gap-3">
              <TextInput
                label="Número de tarjeta"
                required
                inputMode="numeric"
                autoComplete="cc-number"
                value={numeroTarjeta}
                onChange={(event) => setNumeroTarjeta(event.target.value.replace(/\D/g, "").slice(0, 19))}
                placeholder="13 a 19 dígitos"
              />
              <div className="row gap-2 wrap">
                {[1, 3, 6, 12].map((value) => (
                  <Button
                    key={value}
                    variant={cuotas === value ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setCuotas(value)}
                  >
                    {value} {value === 1 ? "cuota" : "cuotas"} ({CUOTAS_RECARGOS[value] * 100}%)
                  </Button>
                ))}
              </div>
            </div>
          )}

          {strategy === "Pago_Transferencia" && (
            <div className="grid-2 gap-2">
              <TextInput
                label="CBU o alias"
                required
                value={cbuOAlias}
                onChange={(event) =>
                  setCbuOAlias(event.target.value.replace(/[^A-Za-z0-9.-]/g, "").slice(0, 22))
                }
                placeholder="CBU de 22 dígitos o alias"
              />
              <TextInput
                label="Código de transferencia"
                required
                value={codigoTransaccion}
                onChange={(event) =>
                  setCodigoTransaccion(event.target.value.replace(/[\u0000-\u001f]/g, "").slice(0, 100))
                }
                placeholder="Identificador de la operación"
              />
            </div>
          )}

          {strategy === "Pago_Efectivo" && (
            <div className="grid-2 gap-2">
              <NumberInput
                label="Efectivo recibido ($)"
                required
                min="0.01"
                step="0.01"
                value={efectivoRecibido}
                onChange={(event) => setEfectivoRecibido(event.target.value)}
                placeholder="Monto entregado"
              />
              <div className="stack gap-1 justify-end pb-2">
                <span className="text-xs text-muted">Vuelto estimado:</span>
                <span className="tabular-nums font-medium text-base text-success">
                  ${vuelto.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          )}

          {validationError && (
            <Alert tone="danger" title="Revisa el cobro" description={validationError} />
          )}

          <div className="stack gap-1 pt-2">
            {recargo > 0 && (
              <div className="row justify-between text-xs text-secondary">
                <span>Recargo estimado:</span>
                <span className="tabular-nums">${recargo.toLocaleString("es-AR")}</span>
              </div>
            )}
            <div className="row justify-between font-medium text-base">
              <span>Total estimado:</span>
              <span className="tabular-nums text-success">${total.toLocaleString("es-AR")}</span>
            </div>
            <span className="text-xs text-muted">El servidor confirma precios, recargo y total final.</span>
          </div>

          <Button
            variant="primary"
            disabled={!cart.length || pending}
            loading={pending}
            loadingLabel="Procesando cobro..."
            onClick={handleCobro}
          >
            Cobrar y emitir comprobante
          </Button>
        </div>
      </div>
    </div>
  );
}
