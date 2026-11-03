import React from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { Badge } from "../../../shared/components/Badge";
import "../ventas-pos.css";

const LABELS_MEDIO = {
  Pago_Efectivo: "Efectivo",
  Pago_Tarjeta: "Tarjeta",
  Pago_Transferencia: "Transferencia bancaria",
};

export function ConfirmarCobroModal({
  open,
  onClose,
  localNombre,
  items = [],
  totalUnits = 0,
  subtotal = 0,
  recargo = 0,
  recargoPct = 0,
  total = 0,
  strategy = "Pago_Efectivo",
  cuotas = 1,
  numeroTarjeta = "",
  cbuOAlias = "",
  codigoTransaccion = "",
  efectivoRecibido = "",
  vuelto = 0,
  pending = false,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revisión de venta y cobro"
      subtitle={`${localNombre} · Consumidor final`}
      footer={
        <div className="pos-review-modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Volver a editar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            loadingLabel="Procesando cobro..."
            onClick={onConfirm}
          >
            Confirmar y emitir comprobante
          </Button>
        </div>
      }
    >
      <div className="stack gap-3">
        {/* Cabecera resumen de la operación */}
        <div className="erp-callout row justify-between align-center p-2.5">
          <div className="stack gap-0.5">
            <span className="text-xs text-muted">Punto de venta emisor:</span>
            <span className="text-xs font-medium text-foreground">{localNombre}</span>
          </div>
          <div className="stack gap-0.5 text-right">
            <span className="text-xs text-muted">Medio seleccionado:</span>
            <Badge tone="info">{LABELS_MEDIO[strategy] || strategy}</Badge>
          </div>
        </div>

        {/* Lista de productos incluidos en la venta */}
        <div className="stack gap-1.5">
          <div className="row justify-between align-center text-xs text-muted">
            <span className="font-medium text-secondary">Artículos a facturar:</span>
            <span className="tabular-nums">{totalUnits} un. en {items.length} líneas</span>
          </div>

          <div className="pos-review-items-scroll">
            {items.map((item) => (
              <div key={item.productoId} className="pos-review-item">
                <div className="stack gap-0.5 truncate flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground truncate">
                    {item.nombre}
                  </span>
                  <span className="text-xs text-muted font-mono">
                    {item.codigo} · {item.cantidad} un. x ${item.precio.toLocaleString("es-AR")}
                  </span>
                </div>
                <span className="tabular-nums font-medium text-xs text-foreground ml-2 shrink-0">
                  ${(item.precio * item.cantidad).toLocaleString("es-AR")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Resumen financiero y desglose de cobro */}
        <div className="pos-review-financial-box stack gap-2">
          <div className="row justify-between text-xs text-secondary">
            <span>Subtotal de artículos:</span>
            <span className="tabular-nums font-medium">
              ${subtotal.toLocaleString("es-AR")}
            </span>
          </div>

          {recargo > 0 && (
            <div className="row justify-between text-xs text-warning">
              <span>Recargo por tarjeta ({recargoPct * 100}%):</span>
              <span className="tabular-nums font-medium">
                +${recargo.toLocaleString("es-AR")}
              </span>
            </div>
          )}

          <div className="row justify-between align-center pt-2 border-t font-medium text-sm">
            <span className="text-foreground">Total neto a cobrar:</span>
            <span className="text-lg font-medium text-success tabular-nums">
              ${total.toLocaleString("es-AR")}
            </span>
          </div>

          {/* Información contextual del medio de pago */}
          <div className="border-t pt-2 mt-1 stack gap-1">
            {strategy === "Pago_Efectivo" && (
              <div className="row justify-between text-xs">
                <span className="text-secondary">
                  Efectivo recibido: ${Number(efectivoRecibido || 0).toLocaleString("es-AR")}
                </span>
                <span className="text-success font-medium tabular-nums">
                  Vuelto a entregar: ${vuelto.toLocaleString("es-AR")}
                </span>
              </div>
            )}

            {strategy === "Pago_Tarjeta" && (
              <div className="row justify-between text-xs text-secondary">
                <span>
                  Plan: {cuotas} {cuotas === 1 ? "cuota" : "cuotas"}
                </span>
                <span className="font-mono">
                  Tarjeta: {numeroTarjeta.length > 4 ? `**** **** **** ${numeroTarjeta.slice(-4)}` : numeroTarjeta}
                </span>
              </div>
            )}

            {strategy === "Pago_Transferencia" && (
              <div className="row justify-between text-xs text-secondary">
                <span>Alias/CBU: {cbuOAlias}</span>
                <span className="font-mono">Comp: {codigoTransaccion}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmarCobroModal;
