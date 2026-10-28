import React, { useEffect, useState } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput } from "../../../shared/components/FormControls";
import { Badge } from "../../../shared/components/Badge";
import { Alert } from "../../../shared/components/Feedback";

export function DevolucionModal({
  open,
  onClose,
  localId,
  facturas = [],
  devoluciones = [],
  facturaInicial = null,
  onSubmit,
  pending = false,
  error = null,
}) {
  const [ventaId, setVentaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cantidades, setCantidades] = useState({});
  const facturaSeleccionada = facturas.find((factura) => String(factura.id) === String(ventaId));
  const devueltoPorProducto = (productoId) => devoluciones
    .filter((devolucion) => String(devolucion.ventaId) === String(ventaId))
    .flatMap((devolucion) => devolucion.items || [])
    .filter((item) => Number(item.productoId) === Number(productoId))
    .reduce((total, item) => total + Number(item.cantidad || 0), 0);

  useEffect(() => {
    if (!open) return;
    setVentaId(String(facturaInicial?.id || facturas[0]?.id || ""));
    setMotivo("");
  }, [open, facturaInicial, facturas]);

  useEffect(() => {
    const empty = {};
    (facturaSeleccionada?.detalles || []).forEach((item) => {
      empty[item.productoId] = 0;
    });
    setCantidades(empty);
  }, [ventaId, facturaSeleccionada]);

  const updateQuantity = (productoId, max, delta) => {
    setCantidades((current) => ({
      ...current,
      [productoId]: Math.max(0, Math.min(max, (current[productoId] || 0) + delta)),
    }));
  };

  const items = (facturaSeleccionada?.detalles || [])
    .map((item) => ({ ...item, cantidad: cantidades[item.productoId] || 0 }))
    .filter((item) => item.cantidad > 0);
  const totalUnidades = items.reduce((sum, item) => sum + item.cantidad, 0);
  const totalEstimado = items.reduce(
    (sum, item) => sum + item.cantidad * Number(item.precio || 0),
    0
  );

  const handleSubmit = async () => {
    if (!facturaSeleccionada || !motivo.trim() || !items.length) return;
    const result = await onSubmit({
      ventaId: facturaSeleccionada.id,
      facturaNumero: facturaSeleccionada.numero,
      localId,
      motivo: motivo.trim(),
      items: items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
      })),
    });
    if (result?.ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar devolución"
      subtitle="Vinculada a la venta original, con impacto en stock y caja."
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={!ventaId || !motivo.trim() || totalUnidades === 0 || pending}
            loading={pending}
            loadingLabel="Registrando devolución..."
          >
            Confirmar devolución
          </Button>
        </div>
      }
    >
      <div className="stack gap-4">
        {error && (
          <Alert tone="danger" title="No se pudo registrar la devolución" description={error.message} />
        )}

        {facturas.length === 0 ? (
          <Alert
            tone="info"
            title="Sin ventas disponibles"
            description="No hay comprobantes emitidos en este local y período."
          />
        ) : (
          <>
            <label className="stack gap-1 text-xs font-medium text-secondary">
              Comprobante original <span className="text-danger">*</span>
              <select
                value={ventaId}
                onChange={(event) => setVentaId(event.target.value)}
                className="erp-input w-full font-mono text-sm"
              >
                {facturas.map((factura) => (
                  <option key={factura.id} value={factura.id}>
                    {factura.numero} · ${Number(factura.total).toLocaleString("es-AR")}
                  </option>
                ))}
              </select>
            </label>

            {facturaSeleccionada && (
              <div className="erp-section-card stack gap-3">
                <div className="row justify-between align-center">
                  <span className="text-xs text-muted">
                    {new Date(facturaSeleccionada.fecha).toLocaleString("es-AR")}
                  </span>
                  <Badge tone="info">{facturaSeleccionada.medioPago}</Badge>
                </div>

                <div className="stack gap-2 pt-2 border-t">
                  {(facturaSeleccionada.detalles || []).map((item) => {
                    const quantity = cantidades[item.productoId] || 0;
                    const returned = devueltoPorProducto(item.productoId);
                    const available = Math.max(0, Number(item.cantidad) - returned);
                    return (
                      <div key={item.productoId} className="row justify-between align-center erp-field">
                        <div className="stack gap-1">
                          <span className="text-xs font-medium">{item.nombre}</span>
                          <span className="text-xs text-muted">
                            Vendidas: {item.cantidad} · Devueltas: {returned} · Disponibles: {available}
                          </span>
                        </div>
                        <div className="row align-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={quantity <= 0}
                            onClick={() => updateQuantity(item.productoId, available, -1)}
                          >
                            -
                          </Button>
                          <span className="tabular-nums font-medium text-xs w-8 text-center">
                            {quantity}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={quantity >= available}
                            onClick={() => updateQuantity(item.productoId, available, 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <TextInput
              label="Motivo"
              required
              value={motivo}
              maxLength={255}
              onChange={(event) => setMotivo(event.target.value.replace(/[\u0000-\u001f]/g, ""))}
              placeholder="Motivo de la devolución"
            />

            <div className="erp-callout stack gap-1">
              <div className="row justify-between text-xs">
                <span>Unidades seleccionadas:</span>
                <strong className="tabular-nums">{totalUnidades}</strong>
              </div>
              <div className="row justify-between text-xs">
                <span>Reintegro estimado:</span>
                <strong className="tabular-nums">${totalEstimado.toLocaleString("es-AR")}</strong>
              </div>
              <p className="text-xs text-secondary">
                El servidor valida el saldo devolvible y registra el ajuste por el medio original. La transferencia de fondos se realiza fuera de Stocky.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
