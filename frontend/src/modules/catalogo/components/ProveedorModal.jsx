import React, { useState, useEffect } from "react";
import { Drawer, Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput } from "../../../shared/components/FormControls";
import { Alert } from "../../../shared/components/Feedback";
import { mapProveedorFormToDTO } from "../mappers/catalogoMappers";

export function ProveedorModal({
  open,
  onClose,
  mode = "create",
  proveedor = null,
  onSubmit,
  onDeactivate,
  pending = false,
  fieldErrors = {},
}) {
  const isEdit = mode === "edit";
  const isDeactivate = mode === "deactivate";
  const Overlay = isDeactivate ? Modal : Drawer;

  const [form, setForm] = useState({ cuit: "", razonSocial: "", telefono: "", email: "" });

  useEffect(() => {
    if (proveedor && (isEdit || isDeactivate)) {
      setForm({
        cuit: proveedor.cuit || "",
        razonSocial: proveedor.razonSocial || "",
        telefono: proveedor.telefono || "",
        email: proveedor.email || "",
      });
    } else {
      setForm({ cuit: "", razonSocial: "", telefono: "", email: "" });
    }
  }, [proveedor, isEdit, isDeactivate, open]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (isDeactivate) {
      if (onDeactivate && (proveedor?.id || proveedor?.cuit)) {
        const res = await onDeactivate(proveedor.id || proveedor.cuit);
        if (res?.ok !== false) onClose();
      }
      return;
    }

    const dto = mapProveedorFormToDTO(form);
    if (onSubmit) {
      const res = isEdit
        ? await onSubmit({ id: proveedor?.id || proveedor?.cuit, dto })
        : await onSubmit(dto);
      if (res?.ok !== false) {
        setForm({ cuit: "", razonSocial: "", telefono: "", email: "" });
        onClose();
      }
    }
  };

  const getTitle = () => {
    if (isDeactivate) return `Dar de baja proveedor: ${proveedor?.razonSocial || ""}`;
    if (isEdit) return `Modificar proveedor: ${proveedor?.razonSocial || ""}`;
    return "Nuevo proveedor comercial";
  };

  const getSubtitle = () => {
    if (isDeactivate) {
      return "Confirmación de baja lógica y preservación de registros históricos.";
    }
    if (isEdit) {
      return "Actualizar datos fiscales o contacto del proveedor.";
    }
    return "Datos fiscales y de contacto para abastecimiento mayorista.";
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
          loadingLabel={isEdit ? "Guardando..." : "Registrando..."}
        >
          {isEdit ? "Guardar cambios" : "Registrar proveedor"}
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
            description="La desactivación de un proveedor preserva toda la trazabilidad de operaciones previas:"
          />
          <ul className="text-sm text-secondary stack gap-2 pl-4 list-disc">
            <li>
              <strong>Historial inmutable:</strong> Las órdenes de abastecimiento, ingresos al centro de distribución y artículos asociados mantienen su referencia intacta.
            </li>
            <li>
              <strong>Restricción operativa:</strong> El proveedor no podrá ser seleccionado para nuevos ingresos ni órdenes futuras.
            </li>
            <li>
              <strong>Preservación fiscal:</strong> La información tributaria permanece archivada para auditoría sin eliminación física de registros.
            </li>
          </ul>
          <div className="p-3 bg-subtle rounded-md border text-xs">
            <span className="font-medium">Proveedor a desactivar:</span> {proveedor?.razonSocial} (CUIT {proveedor?.cuit})
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="stack gap-3">
          <TextInput
            label="CUIT (11 dígitos)"
            required
            mono
            disabled={isEdit}
            value={form.cuit}
            onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))}
            error={fieldErrors.cuit}
            placeholder="p. ej. 30500010912"
            hint={isEdit ? "Identificador fiscal inmutable" : "11 dígitos sin guiones"}
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
      )}
    </Overlay>
  );
}

export default ProveedorModal;
