import React, { useEffect, useState } from "react";
import { Drawer } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput, NumberInput } from "../../../shared/components/FormControls";
import { SearchableSelect } from "../../../shared/components/SearchableSelect";
import { Badge } from "../../../shared/components/Badge";
import { mapProductoFormToDTO } from "../mappers/catalogoMappers";

const emptyForm = { codigo: "", nombre: "", precioVenta: "", costoUnitario: "", categoriaId: "", proveedorId: "", nivelMinimo: 10 };

export function ProductoDrawer({ open, onClose, categorias = [], proveedores = [], producto = null, onSubmit, pending = false, fieldErrors = {} }) {
  const [form, setForm] = useState(emptyForm);
  const isEdit = Boolean(producto?.id);

  useEffect(() => {
    setForm(producto ? {
      codigo: producto.codigo || "", nombre: producto.nombre || "", precioVenta: producto.precioVenta ?? "", costoUnitario: producto.costoUnitario ?? "",
      categoriaId: producto.categoriaId ? String(producto.categoriaId) : "", proveedorId: producto.proveedorId ? String(producto.proveedorId) : "", nivelMinimo: producto.nivelMinimo ?? 1,
    } : emptyForm);
  }, [producto, open]);

  const precio = Number(form.precioVenta) || 0;
  const costo = Number(form.costoUnitario) || 0;
  const margen = precio > 0 ? Math.round(((precio - costo) / precio) * 100) : 0;
  const catOptions = categorias.map((categoria) => ({ value: String(categoria.id), label: categoria.nombre }));
  const provOptions = proveedores.map((proveedor) => ({ value: String(proveedor.id), label: proveedor.razonSocial, description: `CUIT: ${proveedor.cuit}` }));

  const submit = async (event) => {
    event.preventDefault();
    const dto = mapProductoFormToDTO(form);
    if (isEdit) delete dto.codigo;
    if ((await onSubmit(dto))?.ok) onClose();
  };

  return <Drawer
    open={open}
    onClose={onClose}
    title={isEdit ? "Editar producto" : "Nuevo producto"}
    subtitle={isEdit ? `${producto.codigo} · Datos comerciales y de abastecimiento.` : "El SKU se genera automáticamente al guardar."}
    badge={<Badge tone="info">Catálogo</Badge>}
    footer={<div className="row justify-between w-full"><Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={submit} loading={pending} loadingLabel="Guardando...">{isEdit ? "Guardar cambios" : "Crear producto"}</Button></div>}
  >
    <form onSubmit={submit} className="stack gap-4">
      <div className="erp-callout"><span className="text-xs text-secondary">SKU {isEdit ? "inmutable" : "automático"}</span><strong>{isEdit ? producto.codigo : "Se asignará al crear el producto."}</strong></div>
      <TextInput label="Nombre comercial" required value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} error={fieldErrors.nombre} placeholder="Nombre descriptivo del artículo" />
      <div className="grid-2 gap-3">
        <NumberInput label="Costo unitario ($)" required min="0.01" step="0.01" value={form.costoUnitario} onChange={(event) => setForm((current) => ({ ...current, costoUnitario: event.target.value }))} error={fieldErrors.costo_unitario} />
        <NumberInput label="Precio de venta ($)" required min="0.01" step="0.01" value={form.precioVenta} onChange={(event) => setForm((current) => ({ ...current, precioVenta: event.target.value }))} error={fieldErrors.precio_venta} />
      </div>
      <div className="erp-callout row justify-between align-center"><span className="text-xs text-secondary">Margen bruto estimado</span><span className={`tabular-nums font-medium ${margen < 0 ? "text-danger" : "text-success"}`}>{margen}%</span></div>
      <SearchableSelect label="Categoría" placeholder="Buscar categoría" options={catOptions} value={form.categoriaId} onChange={(value) => setForm((current) => ({ ...current, categoriaId: value }))} error={fieldErrors.categoria_id} />
      <SearchableSelect label="Proveedor principal" placeholder="Buscar proveedor" options={provOptions} value={form.proveedorId} onChange={(value) => setForm((current) => ({ ...current, proveedorId: value }))} error={fieldErrors.proveedor_id} />
      {!isEdit && <NumberInput label="Nivel mínimo" min="1" value={form.nivelMinimo} onChange={(event) => setForm((current) => ({ ...current, nivelMinimo: event.target.value }))} error={fieldErrors.nivel_minimo} />}
    </form>
  </Drawer>;
}

export default ProductoDrawer;
