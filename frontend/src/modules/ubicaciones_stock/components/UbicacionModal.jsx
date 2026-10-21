import React, { useState, useEffect } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Badge } from "../../../shared/components/Badge";
import { Alert } from "../../../shared/components/Feedback";

export function UbicacionModal({
  open,
  onClose,
  mode = "create",
  ubicacion = null,
  onSubmit,
  onDeactivate,
  pending = false,
  fieldErrors = {},
}) {
  const isEdit = mode === "edit";
  const isDeactivate = mode === "deactivate";

  const [tipo, setTipo] = useState("LOCAL");
  const [form, setForm] = useState({ nombre: "", direccion: "", telefono: "" });

  useEffect(() => {
    if (ubicacion && (isEdit || isDeactivate)) {
      setTipo(ubicacion.tipo || "LOCAL");
      setForm({
        nombre: ubicacion.nombre || "",
        direccion: ubicacion.direccion || "",
        telefono: ubicacion.telefono || "",
      });
    } else {
      setTipo("LOCAL");
      setForm({ nombre: "", direccion: "", telefono: "" });
    }
  }, [ubicacion, isEdit, isDeactivate, open]);

  const isCD = tipo === "CD";

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (isDeactivate) {
      if (onDeactivate && ubicacion?.id) {
        const res = await onDeactivate(ubicacion.id);
        if (res?.ok !== false) onClose();
      }
      return;
    }

    const dto = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      telefono: form.telefono.trim() || undefined,
    };

    if (onSubmit) {
      const res = await onSubmit({ tipo, dto, id: ubicacion?.id });
      if (res?.ok !== false) {
        setForm({ nombre: "", direccion: "", telefono: "" });
        onClose();
      }
    }
  };

  const getTitle = () => {
    if (isDeactivate) return `Dar de baja sede: ${ubicacion?.nombre || ""}`;
    if (isEdit) return `Editar ${isCD ? "Centro de Distribución" : "Local Comercial"}`;
    return isCD ? "Nuevo Centro de Distribución" : "Nuevo Local Comercial";
  };

  const getSubtitle = () => {
    if (isDeactivate) {
      return "Confirmación de baja lógica y explicación de impacto histórico.";
    }
    if (isEdit) {
      return `Modificar datos de la sede física ID ${ubicacion?.id || ""}.`;
    }
    return "Configuración de nodos físicos de la red logística y comercial.";
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
          loadingLabel="Guardando..."
        >
          {isEdit ? "Guardar cambios" : "Crear ubicación"}
        </Button>
      </div>
    );
  };

  return (
    <Modal
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
            description="La desactivación de una sede es irreversible para operaciones en curso y preserva la integridad del sistema:"
          />
          <ul className="text-sm text-secondary stack gap-2 pl-4 list-disc">
            <li>
              <strong>Historial inmutable:</strong> Todos los movimientos de stock pasados, remitos despachados y ventas registradas permanecerán intactos para consultas y auditoría.
            </li>
            <li>
              <strong>Restricción operativa:</strong> La sede ya no podrá ser seleccionada como origen ni destino en nuevos despachos, compras ni puntos de venta.
            </li>
            <li>
              <strong>Validación de stock:</strong> El sistema rechazará la baja si la sede posee unidades disponibles en existencia o bultos en tránsito pendientes de recepción.
            </li>
          </ul>
          <div className="p-3 bg-subtle rounded-md border text-xs">
            <span className="font-medium">Sede a desactivar:</span> {ubicacion?.nombre} ({ubicacion?.direccion})
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="stack gap-4">
          {!isEdit && (
            <FormField label="Tipo de sede">
              <SegmentedControl
                value={tipo}
                onChange={setTipo}
                options={[
                  { value: "LOCAL", label: "Local minorista", icon: "store" },
                  { value: "CD", label: "Centro de distribución", icon: "warehouse" },
                ]}
              />
            </FormField>
          )}

          {isEdit && (
            <div className="row align-center gap-2">
              <span className="text-xs text-secondary font-medium">Tipo de sede:</span>
              <Badge tone={isCD ? "cd" : "local"}>
                {isCD ? "Centro de distribución (CD)" : "Local minorista"}
              </Badge>
            </div>
          )}

          <div className="text-xs text-secondary bg-subtle p-2 rounded">
            {isCD
              ? "El Centro de Distribución opera como nodo central: recibe compras a proveedores y abastece a sucursales."
              : "El Local Comercial opera en el borde: solicita reposición al CD, recibe bultos y registra ventas minoristas."}
          </div>

          <TextInput
            label="Nombre de la sede"
            required
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            error={fieldErrors.nombre}
            placeholder={isCD ? "p. ej. Centro de Distribución Norte" : "p. ej. Sucursal Belgrano"}
          />

          <TextInput
            label="Dirección física"
            required
            value={form.direccion}
            onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            error={fieldErrors.direccion}
            placeholder="Calle, número, localidad y provincia"
          />

          <TextInput
            label={isCD ? "Teléfono de contacto (opcional)" : "Teléfono de contacto"}
            required={!isCD}
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            error={fieldErrors.telefono}
            placeholder="011-4700-0000"
          />
        </form>
      )}
    </Modal>
  );
}

export default UbicacionModal;
