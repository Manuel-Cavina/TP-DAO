import React, { useState, useEffect } from "react";
import { Drawer, Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput } from "../../../shared/components/FormControls";
import { Alert } from "../../../shared/components/Feedback";

export function CategoriaModal({
  open,
  onClose,
  mode = "create",
  categoria = null,
  onSubmit,
  onDeactivate,
  pending = false,
  fieldErrors = {},
}) {
  const isEdit = mode === "edit";
  const isDeactivate = mode === "deactivate";
  const Overlay = isDeactivate ? Modal : Drawer;

  const [nombre, setNombre] = useState("");

  useEffect(() => {
    if (categoria && (isEdit || isDeactivate)) {
      setNombre(categoria.nombre || "");
    } else {
      setNombre("");
    }
  }, [categoria, isEdit, isDeactivate, open]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (isDeactivate) {
      if (onDeactivate && categoria?.id) {
        const res = await onDeactivate(categoria.id);
        if (res?.ok !== false) onClose();
      }
      return;
    }

    if (!nombre.trim()) return;

    if (onSubmit) {
      const res = isEdit
        ? await onSubmit({ id: categoria?.id, dto: { nombre: nombre.trim() } })
        : await onSubmit({ nombre: nombre.trim() });
      if (res?.ok !== false) {
        setNombre("");
        onClose();
      }
    }
  };

  const getTitle = () => {
    if (isDeactivate) return `Dar de baja categoría: ${categoria?.nombre || ""}`;
    if (isEdit) return `Editar categoría: ${categoria?.nombre || ""}`;
    return "Nueva categoría de artículos";
  };

  const getSubtitle = () => {
    if (isDeactivate) {
      return "Confirmación de baja lógica y preservación de registros históricos.";
    }
    if (isEdit) {
      return "Modificar nombre de la categoría en el catálogo.";
    }
    return "Clasificación taxonómica para organización del inventario y reportes.";
  };

  const renderFooter = () => {
    if (isDeactivate) {
      return (
        <div className="row justify-between w-full align-center">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={pending}
            loadingLabel="Desactivando..."
          >
            Confirmar baja lógica
          </Button>
        </div>
      );
    }

    return (
      <div className="row justify-between w-full align-center">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={pending}
          loadingLabel={isEdit ? "Guardando..." : "Creando..."}
        >
          {isEdit ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </div>
    );
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={getTitle()}
      subtitle={getSubtitle()}
      footer={renderFooter()}
    >
      {isDeactivate ? (
        <div className="stack gap-4">
          <Alert
            tone="warning"
            title="Impacto de la baja en registros históricos"
            description="La desactivación de una categoría preserva la integridad del historial de artículos y compras:"
          />
          <ul className="text-sm text-secondary stack gap-2 pl-4 list-disc">
            <li>
              <strong>Historial inmutable:</strong> Los productos existentes asociados a esta categoría conservan su referencia histórica para reportes y auditorías.
            </li>
            <li>
              <strong>Restricción operativa:</strong> La categoría ya no podrá ser seleccionada para nuevos productos del catálogo.
            </li>
            <li>
              <strong>Preservación:</strong> No se eliminan datos físicos del sistema ni se modifican artículos comercializados.
            </li>
          </ul>
          <div className="p-3 bg-subtle rounded-md border text-xs">
            <span className="font-medium">Categoría a desactivar:</span> {categoria?.nombre} (ID {categoria?.id})
          </div>
        </div>
      ) : (
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
      )}
    </Overlay>
  );
}

export default CategoriaModal;
