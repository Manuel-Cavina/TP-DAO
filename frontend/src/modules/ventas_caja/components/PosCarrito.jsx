import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../../../shared/components/Button";
import { PaymentStrategySelector } from "../../../shared/components/DomainWidgets";
import { TextInput, NumberInput } from "../../../shared/components/FormControls";
import { Badge } from "../../../shared/components/Badge";
import { Alert } from "../../../shared/components/Feedback";
import { Icon } from "../../../shared/components/Icon";
import { AnimatedCounter } from "../../../components/arc/animated-counter/animated-counter";

const CUOTAS_RECARGOS = { 1: 0, 3: 0.1, 6: 0.2, 12: 0.35 };

export function PosCarrito({
  cart = [],
  stockByProduct,
  strategy,
  setStrategy,
  cuotas,
  setCuotas,
  efectivoRecibido,
  setEfectivoRecibido,
  numeroTarjeta,
  setNumeroTarjeta,
  cbuOAlias,
  setCbuOAlias,
  codigoTransaccion,
  setCodigoTransaccion,
  validationError,
  setValidationError,
  pending = false,
  totalUnits = 0,
  subtotal = 0,
  recargo = 0,
  recargoPct = 0,
  total = 0,
  vuelto = 0,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
  onCobro,
}) {
  return (
    <div className="erp-section-card pos-column">
      {/* Cabecera del carrito */}
      <div className="row justify-between align-center mb-2">
        <div className="row align-center gap-2">
          <h3 className="text-md font-medium">2. Carrito y cobro</h3>
          <Badge tone="neutral" className="tabular-nums">
            {totalUnits} un. ({cart.length} líneas)
          </Badge>
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearCart}>
            Vaciar
          </Button>
        )}
      </div>

      {/* Lista interna de ítems en el carrito */}
      <div className="pos-cart-scroll">
        {cart.length === 0 ? (
          <div className="p-4 text-center my-auto">
            <Icon
              name="package"
              size={28}
              className="text-muted mx-auto mb-2 opacity-50"
            />
            <p className="text-xs font-medium text-foreground">
              Carrito vacío
            </p>
            <p className="text-xs text-muted mt-1">
              Selecciona productos de la lista para comenzar la venta.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {cart.map((item) => {
              const available =
                stockByProduct.get(Number(item.productoId)) || 0;
              return (
                <motion.div
                  key={item.productoId}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    marginBottom: 0,
                    overflow: "hidden",
                  }}
                  transition={{ duration: 0.15 }}
                  className="pos-cart-item row justify-between align-center"
                >
                  <div className="stack gap-0.5 truncate flex-1 min-w-0">
                    <span className="text-xs font-medium truncate">
                      {item.nombre}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      ${item.precio.toLocaleString("es-AR")} c/u · máx{" "}
                      {available} un.
                    </span>
                  </div>

                  <div className="row align-center gap-1.5 ml-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateQuantity(item.productoId, -1)}
                      aria-label="Restar una unidad"
                    >
                      -
                    </Button>
                    <span className="pos-cart-qty-display tabular-nums font-medium text-xs px-1">
                      {item.cantidad}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={item.cantidad >= available}
                      onClick={() => onUpdateQuantity(item.productoId, 1)}
                      aria-label="Sumar una unidad"
                    >
                      +
                    </Button>
                    <span className="pos-cart-line-total tabular-nums font-medium text-xs ml-1">
                      ${(item.precio * item.cantidad).toLocaleString("es-AR")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(item.productoId)}
                      className="text-muted hover:text-danger p-1 transition-colors ml-1"
                      aria-label={`Eliminar ${item.nombre}`}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Resumen financiero ("En cuánto va a quedar") y cobro */}
      <div className="pos-fixed-footer stack gap-2 pt-2">
        {/* Card resumen de importes */}
        <div className="pos-financial-summary">
          <div className="row justify-between text-xs text-secondary mb-1">
            <span>Subtotal ({totalUnits} unidades):</span>
            <span className="tabular-nums">
              ${subtotal.toLocaleString("es-AR")}
            </span>
          </div>
          {recargo > 0 && (
            <div className="row justify-between text-xs text-warning mb-1">
              <span>Recargo por tarjeta ({recargoPct * 100}%):</span>
              <span className="tabular-nums">
                +${recargo.toLocaleString("es-AR")}
              </span>
            </div>
          )}
          <div className="row justify-between align-center pt-1.5 border-t mt-1 font-medium text-sm">
            <span className="text-foreground">Total a pagar:</span>
            <span className="text-xl font-medium text-success tabular-nums">
              <AnimatedCounter value={total} prefix="$ " locale="es-AR" />
            </span>
          </div>
        </div>

        {/* Selector de estrategia de pago */}
        <PaymentStrategySelector
          value={strategy}
          onChange={(val) => {
            setStrategy(val);
            setValidationError("");
          }}
        />

        {/* Inputs según medio de pago */}
        {strategy === "Pago_Tarjeta" && (
          <div className="stack gap-2">
            <TextInput
              label="Número de tarjeta"
              required
              inputMode="numeric"
              autoComplete="cc-number"
              value={numeroTarjeta}
              onChange={(event) =>
                setNumeroTarjeta(
                  event.target.value.replace(/\D/g, "").slice(0, 19)
                )
              }
              placeholder="13 a 19 dígitos"
            />
            <div className="row gap-1.5 wrap">
              {[1, 3, 6, 12].map((val) => (
                <Button
                  key={val}
                  variant={cuotas === val ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setCuotas(val)}
                >
                  {val} {val === 1 ? "cuota" : "cuotas"} (
                  {CUOTAS_RECARGOS[val] * 100}%)
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
                setCbuOAlias(
                  event.target.value
                    .replace(/[^A-Za-z0-9.-]/g, "")
                    .slice(0, 22)
                )
              }
              placeholder="CBU o alias"
            />
            <TextInput
              label="Código de comprobante"
              required
              value={codigoTransaccion}
              onChange={(event) =>
                setCodigoTransaccion(
                  event.target.value
                    .replace(/[\u0000-\u001f]/g, "")
                    .slice(0, 100)
                )
              }
              placeholder="Nº de transacción"
            />
          </div>
        )}

        {strategy === "Pago_Efectivo" && (
          <div className="grid-2 gap-2 align-center">
            <NumberInput
              label="Efectivo recibido ($)"
              required
              min="0.01"
              step="0.01"
              value={efectivoRecibido}
              onChange={(event) => setEfectivoRecibido(event.target.value)}
              placeholder="Monto entregado"
            />
            <div className="stack gap-0.5 justify-end">
              <span className="text-xs text-muted">Vuelto a entregar:</span>
              <span className="tabular-nums font-medium text-lg text-success">
                <AnimatedCounter value={vuelto} prefix="$ " locale="es-AR" />
              </span>
            </div>
          </div>
        )}

        {validationError && (
          <Alert
            tone="danger"
            title="Revisa el cobro"
            description={validationError}
          />
        )}

        {/* Botón CTA principal: Abre la revisión de compra antes de emitir */}
        <Button
          variant="primary"
          size="lg"
          className="w-full mt-1"
          disabled={!cart.length || pending}
          onClick={onCobro}
        >
          Revisar y cobrar: ${total.toLocaleString("es-AR")}
        </Button>
      </div>
    </div>
  );
}

export default PosCarrito;
