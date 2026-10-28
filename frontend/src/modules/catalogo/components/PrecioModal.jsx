import React, { useState, useEffect } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { NumberInput } from "../../../shared/components/FormControls";

export function PrecioModal({ open, onClose, producto, onSubmit, pending = false }) {
  const [nuevoPrecio, setNuevoPrecio] = useState("");

  useEffect(() => {
    if (producto) setNuevoPrecio(String(producto.precioVenta || ""));
  }, [producto]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const precio = Number(nuevoPrecio);
    if (!precio || precio <= 0) return;
    const res = await onSubmit({ codigo: producto.codigo, precio });
    if (res?.ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actualizar precio de venta"
      subtitle={`Producto: ${producto?.nombre || ""} (${producto?.codigo || ""})`}
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={pending} loadingLabel="Actualizando...">
            Guardar nuevo precio
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack gap-3">
        <p className="text-xs text-secondary">
          El cambio afectará ventas futuras. Las facturas y ventas históricas ya registradas conservarán su precio inmutable.
        </p>
        <NumberInput
          label="Nuevo precio de venta ($)"
          required
          min="0.01"
          step="0.01"
          value={nuevoPrecio}
          onChange={(e) => setNuevoPrecio(e.target.value)}
          placeholder="0.00"
        />
      </form>
    </Modal>
  );
}
