import React, { useState } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput } from "../../../shared/components/FormControls";

export function CategoriaModal({ open, onClose, onSubmit, pending = false, fieldErrors = {} }) {
  const [nombre, setNombre] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const res = await onSubmit({ nombre: nombre.trim() });
    if (res?.ok) {
      setNombre("");
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva categoría de artículos"
      subtitle="Clasificación para organización del inventario y reportes."
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={pending} loadingLabel="Creando...">
            Crear categoría
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack gap-3">
        <TextInput
          label="Nombre de la categoría"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={fieldErrors.nombre}
          placeholder="p. ej. Ferretería y Herramientas"
        />
      </form>
    </Modal>
  );
}
