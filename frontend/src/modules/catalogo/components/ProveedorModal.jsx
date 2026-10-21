import React, { useState, useEffect } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput } from "../../../shared/components/FormControls";
import { mapProveedorFormToDTO } from "../mappers/catalogoMappers";

export function ProveedorModal({ open, onClose, proveedor, onSubmit, pending = false, fieldErrors = {} }) {
  const isEditing = Boolean(proveedor?.cuit);
  const [form, setForm] = useState({ cuit: "", razonSocial: "", telefono: "", email: "" });

  useEffect(() => {
    if (proveedor) {
      setForm({
        cuit: proveedor.cuit || "",
        razonSocial: proveedor.razonSocial || "",
        telefono: proveedor.telefono || "",
        email: proveedor.email || "",
      });
    } else {
      setForm({ cuit: "", razonSocial: "", telefono: "", email: "" });
    }
  }, [proveedor, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dto = mapProveedorFormToDTO(form);
    const res = isEditing
      ? await onSubmit({ cuit: proveedor.cuit, dto })
      : await onSubmit(dto);
    if (res?.ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Modificar proveedor" : "Nuevo proveedor"}
      subtitle="Datos fiscales y de contacto para abastecimiento mayorista."
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={pending} loadingLabel="Guardando...">
            {isEditing ? "Guardar cambios" : "Registrar proveedor"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack gap-3">
        <TextInput
          label="CUIT (11 dígitos)"
          required
          mono
          disabled={isEditing}
          value={form.cuit}
          onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))}
          error={fieldErrors.cuit}
          placeholder="p. ej. 30500010912"
        />
        <TextInput
          label="Razón social"
          required
          value={form.razonSocial}
          onChange={(e) => setForm((f) => ({ ...f, razonSocial: e.target.value }))}
          error={fieldErrors.razon_social}
          placeholder="Nombre o razón social"
        />
        <TextInput
          label="Teléfono de contacto"
          value={form.telefono}
          onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
          error={fieldErrors.telefono}
          placeholder="011-4340-1000"
        />
        <TextInput
          label="Correo electrónico"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={fieldErrors.email}
          placeholder="contacto@proveedor.com.ar"
        />
      </form>
    </Modal>
  );
}
