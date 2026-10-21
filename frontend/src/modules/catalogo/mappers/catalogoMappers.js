/**
 * Mappers entre DTOs del backend (/api/catalogo) y modelos de interfaz.
 */

export function mapProductoToUI(dto) {
  if (!dto) return null;
  const precio = Number(dto.precio_venta) || 0;
  const costo = Number(dto.costo_unitario) || 0;
  const margen = precio > 0 ? Math.round(((precio - costo) / precio) * 100) : 0;

  return {
    id: dto.id,
    codigo: dto.codigo,
    nombre: dto.nombre,
    precioVenta: precio,
    costoUnitario: costo,
    categoriaId: dto.categoria_id,
    proveedorId: dto.proveedor_id,
    activo: Boolean(dto.activo),
    nivelMinimo: Number(dto.nivel_minimo) || 1,
    margenPct: margen,
  };
}

export function mapProductoFormToDTO(form) {
  return {
    codigo: String(form.codigo || "").trim().toUpperCase(),
    nombre: String(form.nombre || "").trim(),
    precio_venta: Number(form.precioVenta) || 0,
    costo_unitario: Number(form.costoUnitario) || 0,
    categoria_id: Number(form.categoriaId),
    proveedor_id: Number(form.proveedorId),
    nivel_minimo: Number(form.nivelMinimo) || 1,
  };
}

export function mapProveedorToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    cuit: dto.cuit,
    razonSocial: dto.razon_social,
    telefono: dto.telefono || "",
    email: dto.email || "",
    activo: Boolean(dto.activo),
  };
}

export function mapProveedorFormToDTO(form) {
  return {
    cuit: String(form.cuit || "").replace(/\D/g, ""),
    razon_social: String(form.razonSocial || "").trim(),
    telefono: String(form.telefono || "").trim(),
    email: String(form.email || "").trim(),
  };
}

export function mapCategoriaToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    nombre: dto.nombre,
    activo: dto.activo !== undefined ? Boolean(dto.activo) : true,
  };
}
