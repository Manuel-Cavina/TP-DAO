import React, { useState } from "react";
import { Drawer } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput, NumberInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { Badge } from "../../../shared/components/Badge";
import { mapProductoFormToDTO } from "../mappers/catalogoMappers";

export function ProductoDrawer({
  open,
  onClose,
  categorias = [],
  proveedores = [],
  onSubmit,
  pending = false,
  fieldErrors = {},
}) {
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    precioVenta: "",
    costoUnitario: "",
    categoriaId: "",
    proveedorId: "",
    nivelMinimo: 10,
  });

  const catOptions = categorias.map((c) => ({ value: String(c.id), label: c.nombre }));
  const provOptions = proveedores.map((p) => ({ value: String(p.id), label: `${p.razonSocial} (${p.cuit})` }));

  const precio = Number(form.precioVenta) || 0;
  const costo = Number(form.costoUnitario) || 0;
  const margen = precio > 0 ? Math.round(((precio - costo) / precio) * 100) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dto = mapProductoFormToDTO(form);
    const res = await onSubmit(dto);
    if (res?.ok) {
      setForm({ codigo: "", nombre: "", precioVenta: "", costoUnitario: "", categoriaId: "", proveedorId: "", nivelMinimo: 10 });
      onClose();
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nuevo producto en catálogo"
      subtitle="El producto quedará disponible para abastecimiento y despacho."
      badge={<Badge tone="info">Catálogo</Badge>}
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={pending} loadingLabel="Guardando...">
            Crear producto
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack gap-4">
        <TextInput
          label="Código / SKU"
          hint="Identificador único"
          required
          mono
          value={form.codigo}
          onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
          error={fieldErrors.codigo}
          placeholder="p. ej. ALM-010"
        />

        <TextInput
          label="Nombre comercial"
          required
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          error={fieldErrors.nombre}
          placeholder="Nombre descriptivo del artículo"
        />

        <div className="grid-2 gap-3">
          <NumberInput
            label="Costo unitario ($)"
            required
            min="0.01"
            step="0.01"
            value={form.costoUnitario}
            onChange={(e) => setForm((f) => ({ ...f, costoUnitario: e.target.value }))}
            error={fieldErrors.costo_unitario}
            placeholder="0.00"
          />

          <NumberInput
            label="Precio de venta ($)"
            required
            min="0.01"
            step="0.01"
            value={form.precioVenta}
            onChange={(e) => setForm((f) => ({ ...f, precioVenta: e.target.value }))}
            error={fieldErrors.precio_venta}
            placeholder="0.00"
          />
        </div>

        <div className="erp-callout row justify-between align-center">
          <span className="text-xs text-secondary">Margen bruto estimado:</span>
          <span className={`tabular-nums font-medium ${margen < 0 ? "text-danger" : "text-success"}`}>
            {margen}%
          </span>
        </div>

        <FormField label="Categoría" required error={fieldErrors.categoria_id}>
          <Select
            options={catOptions}
            value={form.categoriaId ? String(form.categoriaId) : (catOptions[0]?.value || "")}
            onChange={(val) => setForm((f) => ({ ...f, categoriaId: val }))}
            placeholder="Seleccionar categoría"
          />
        </FormField>

        <FormField label="Proveedor principal" required error={fieldErrors.proveedor_id}>
          <Select
            options={provOptions}
            value={form.proveedorId ? String(form.proveedorId) : (provOptions[0]?.value || "")}
            onChange={(val) => setForm((f) => ({ ...f, proveedorId: val }))}
            placeholder="Seleccionar proveedor"
          />
        </FormField>

        <NumberInput
          label="Nivel mínimo sugerido"
          hint="Para alertas Observer"
          min="1"
          value={form.nivelMinimo}
          onChange={(e) => setForm((f) => ({ ...f, nivelMinimo: e.target.value }))}
          error={fieldErrors.nivel_minimo}
        />
      </form>
    </Drawer>
  );
}
