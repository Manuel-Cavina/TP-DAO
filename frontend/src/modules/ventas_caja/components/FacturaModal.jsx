import React from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { Badge } from "../../../shared/components/Badge";

export function FacturaModal({ open, onClose, factura, onIniciarDevolucion }) {
  if (!factura) return null;
  const totalArticulos = (factura.detalles || []).reduce(
    (sum, item) => sum + Number(item.cantidad || 0),
    0
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Comprobante interno de venta"
      subtitle={`No fiscal · ${factura.numero} · ${new Date(factura.fecha).toLocaleString("es-AR")}`}
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {onIniciarDevolucion && (
            <Button
              variant="secondary"
              iconLeft="refresh"
              onClick={() => {
                onClose();
                onIniciarDevolucion(factura);
              }}
            >
              Registrar devolución
            </Button>
          )}
        </div>
      }
    >
      <div className="stack gap-4">
        <div className="row justify-between align-center erp-section-card">
          <div className="stack gap-1">
            <span className="text-xs text-muted">Local:</span>
            <span className="font-medium text-sm">#{factura.localId}</span>
          </div>
          <div className="stack gap-1 text-right">
            <span className="text-xs text-muted">Medio de pago:</span>
            <Badge tone="success">{factura.medioPago}</Badge>
          </div>
        </div>

        <div className="stack gap-2">
          <div className="row justify-between align-center">
            <h4 className="text-xs text-muted font-medium">Artículos</h4>
            <span className="text-xs text-muted tabular-nums">{totalArticulos} unidades</span>
          </div>
          {(factura.detalles || []).map((item) => (
            <div key={item.productoId} className="row justify-between align-center erp-field">
              <div className="stack gap-1">
                <span className="text-sm font-medium">{item.nombre}</span>
                <span className="text-xs text-muted font-mono">
                  {item.codigo} · {item.cantidad} un. x ${Number(item.precio).toLocaleString("es-AR")}
                </span>
              </div>
              <span className="tabular-nums font-medium text-sm">
                ${Number(item.subtotal || item.precio * item.cantidad).toLocaleString("es-AR")}
              </span>
            </div>
          ))}
        </div>

        <div className="erp-section-card stack gap-2">
          <div className="row justify-between text-xs text-secondary">
            <span>Subtotal:</span>
            <span className="tabular-nums">${Number(factura.subtotal).toLocaleString("es-AR")}</span>
          </div>
          {Number(factura.recargo) > 0 && (
            <div className="row justify-between text-xs text-secondary">
              <span>Recargo:</span>
              <span className="tabular-nums">+${Number(factura.recargo).toLocaleString("es-AR")}</span>
            </div>
          )}
          <div className="row justify-between font-medium text-base pt-2 border-t">
            <span>Total cobrado:</span>
            <span className="tabular-nums text-success">
              ${Number(factura.total).toLocaleString("es-AR")}
            </span>
          </div>
          {Number(factura.vuelto) > 0 && (
            <div className="row justify-between text-xs text-secondary">
              <span>Vuelto:</span>
              <span className="tabular-nums">${Number(factura.vuelto).toLocaleString("es-AR")}</span>
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
}
