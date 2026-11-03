import React, { useEffect, useMemo, useState } from "react";
import { mapCheckoutToDTO } from "../mappers/ventasMappers";
import { PosCatalogo } from "./PosCatalogo";
import { PosCarrito } from "./PosCarrito";
import { ConfirmarCobroModal } from "./ConfirmarCobroModal";
import "../ventas-pos.css";

const CUOTAS_RECARGOS = { 1: 0, 3: 0.1, 6: 0.2, 12: 0.35 };

export function PosTerminal({
  productos = [],
  stocks = [],
  localId,
  localNombre = "Punto de venta",
  onCheckout,
  pending = false,
  loading = false,
  loadError = null,
}) {
  const [cart, setCart] = useState([]);
  const [strategy, setStrategy] = useState("Pago_Efectivo");
  const [cuotas, setCuotas] = useState(1);
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [cbuOAlias, setCbuOAlias] = useState("");
  const [codigoTransaccion, setCodigoTransaccion] = useState("");
  const [validationError, setValidationError] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const stockByProduct = useMemo(
    () =>
      new Map(
        stocks.map((stock) => [
          Number(stock.productoId),
          Number(stock.disponible) || 0,
        ])
      ),
    [stocks]
  );

  // Limpiar carrito si cambia el punto de venta para evitar inconsistencias de inventario
  useEffect(() => {
    setCart([]);
    setValidationError("");
    setReviewModalOpen(false);
  }, [localId]);

  const addToCart = (product) => {
    const available = stockByProduct.get(Number(product.id)) || 0;
    const selected =
      cart.find((item) => Number(item.productoId) === Number(product.id))
        ?.cantidad || 0;

    if (available <= 0) {
      setValidationError(
        `No hay stock disponible de ${product.nombre} en este local.`
      );
      return;
    }

    if (selected >= available) {
      setValidationError(
        `Alcanzaste el límite de stock disponible (${available} un.) de ${product.nombre}.`
      );
      return;
    }

    setCart((current) => {
      const index = current.findIndex(
        (item) => Number(item.productoId) === Number(product.id)
      );
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

  const updateQuantity = (productoId, delta) => {
    const available = stockByProduct.get(Number(productoId)) || 0;
    setCart((current) =>
      current
        .map((item) => {
          if (item.productoId !== productoId) return item;
          const nextQty = item.cantidad + delta;
          if (nextQty > available) {
            setValidationError(
              `Stock máximo disponible alcanzado (${available} un.).`
            );
            return item;
          }
          return { ...item, cantidad: nextQty };
        })
        .filter((item) => item.cantidad > 0)
    );
    setValidationError("");
  };

  const removeFromCart = (productoId) => {
    setCart((current) =>
      current.filter((item) => item.productoId !== productoId)
    );
  };

  const clearCart = () => {
    setCart([]);
    setValidationError("");
  };

  const totalUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.cantidad, 0),
    [cart]
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
    [cart]
  );
  const recargoPct =
    strategy === "Pago_Tarjeta" ? CUOTAS_RECARGOS[cuotas] || 0 : 0;
  const recargo = Math.round(subtotal * recargoPct * 100) / 100;
  const total = subtotal + recargo;
  const cash = Number(efectivoRecibido);
  const vuelto =
    strategy === "Pago_Efectivo" && cash > total
      ? Math.round((cash - total) * 100) / 100
      : 0;

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

  // Abre el modal de revisión previa validando primero los datos requeridos
  const handleOpenReview = () => {
    try {
      mapCheckoutToDTO(checkoutForm);
      setValidationError("");
      setReviewModalOpen(true);
    } catch (error) {
      setValidationError(error.message);
    }
  };

  // Confirma definitivamente el cobro y emite comprobante
  const handleConfirmCobro = async () => {
    const result = await onCheckout(checkoutForm);
    if (result?.ok) {
      setReviewModalOpen(false);
      setCart([]);
      setEfectivoRecibido("");
      setNumeroTarjeta("");
      setCbuOAlias("");
      setCodigoTransaccion("");
    } else if (result?.error?.message) {
      setValidationError(result.error.message);
    }
  };

  return (
    <div className="pos-terminal-layout">
      <PosCatalogo
        productos={productos}
        stockByProduct={stockByProduct}
        cart={cart}
        localNombre={localNombre}
        loading={loading}
        loadError={loadError}
        onAddToCart={addToCart}
      />
      <PosCarrito
        cart={cart}
        stockByProduct={stockByProduct}
        strategy={strategy}
        setStrategy={setStrategy}
        cuotas={cuotas}
        setCuotas={setCuotas}
        efectivoRecibido={efectivoRecibido}
        setEfectivoRecibido={setEfectivoRecibido}
        numeroTarjeta={numeroTarjeta}
        setNumeroTarjeta={setNumeroTarjeta}
        cbuOAlias={cbuOAlias}
        setCbuOAlias={setCbuOAlias}
        codigoTransaccion={codigoTransaccion}
        setCodigoTransaccion={setCodigoTransaccion}
        validationError={validationError}
        setValidationError={setValidationError}
        pending={pending}
        totalUnits={totalUnits}
        subtotal={subtotal}
        recargo={recargo}
        recargoPct={recargoPct}
        total={total}
        vuelto={vuelto}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
        onClearCart={clearCart}
        onCobro={handleOpenReview}
      />

      {/* Modal de revisión de compra antes de emitir comprobante */}
      <ConfirmarCobroModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        localNombre={localNombre}
        items={cart}
        totalUnits={totalUnits}
        subtotal={subtotal}
        recargo={recargo}
        recargoPct={recargoPct}
        total={total}
        strategy={strategy}
        cuotas={cuotas}
        numeroTarjeta={numeroTarjeta}
        cbuOAlias={cbuOAlias}
        codigoTransaccion={codigoTransaccion}
        efectivoRecibido={efectivoRecibido}
        vuelto={vuelto}
        pending={pending}
        onConfirm={handleConfirmCobro}
      />
    </div>
  );
}

export default PosTerminal;
