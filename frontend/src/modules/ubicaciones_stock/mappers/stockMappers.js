/**
 * Mappers para el módulo ubicaciones_stock.
 */

export function mapUbicacionToUI(dto) {
  if (!dto) return null;
  const isCD = dto.tipo === "CD";
  return {
    id: dto.id,
    tipo: dto.tipo,
    nombre: dto.nombre,
    direccion: dto.direccion,
    telefono: dto.telefono || "",
    activo: Boolean(dto.activo),
    scopeLabel: isCD ? "Centro de distribución" : "Local comercial",
    icon: isCD ? "warehouse" : "store",
  };
}

export function mapStockToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    productoId: dto.producto_id,
    ubicacionId: dto.ubicacion_id,
    disponible: Number(dto.cantidad_disponible) || 0,
    enTransito: Number(dto.cantidad_en_transito) || 0,
    nivelMinimo: Number(dto.nivel_minimo_existencia) || 1,
  };
}

export function mapAlertaToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    stockId: dto.stock_id,
    productoId: dto.producto_id,
    ubicacionId: dto.ubicacion_id,
    disponible: Number(dto.cantidad_disponible) || 0,
    nivelMinimo: Number(dto.nivel_minimo) || 1,
    fechaEmision: dto.fecha_emision,
    leida: Boolean(dto.leida),
  };
}
