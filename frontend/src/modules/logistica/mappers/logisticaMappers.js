/**
 * Mappers para el módulo de logística y trazabilidad de bultos.
 */

export function mapNecesidadToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    productoId: dto.producto_id,
    localId: dto.local_id,
    cantidad: Number(dto.cantidad) || 0,
    estado: dto.estado,
    fechaRegistro: dto.fecha_registro,
  };
}

export function mapOrdenToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    origenId: dto.origen_id,
    destinoId: dto.destino_id,
    fecha: dto.fecha,
    estado: dto.estado,
    detalles: (dto.detalles || []).map((d) => ({
      id: d.id,
      productoId: d.producto_id,
      cantidadSolicitada: Number(d.cantidad_solicitada) || 0,
      cantidadEnviada: Number(d.cantidad_enviada) || 0,
    })),
  };
}

export function mapBultoToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    ordenId: dto.orden_id,
    remitoNumero: dto.remito_numero,
    codigoPrecinto: dto.codigo_precinto,
    estado: dto.estado,
    detalles: (dto.detalles || []).map((d) => ({
      id: d.id,
      productoId: d.producto_id,
      cantidad: Number(d.cantidad) || 0,
    })),
  };
}

export function mapBultoResumenToUI(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    codigo: dto.codigo || `BLT-${String(dto.id).padStart(4, "0")}`,
    codigoPrecinto: dto.codigo_precinto || null,
    estado: dto.estado,
    cantidadItems: Number(dto.cantidad_items) || 0,
  };
}

export function mapRemitoToUI(dto) {
  if (!dto) return null;
  const bultosResumen = (dto.bultos_resumen || []).map(mapBultoResumenToUI);
  const totalBultos = Number(dto.total_bultos) || bultosResumen.length;
  const bultosVerificados =
    Number(dto.bultos_verificados) ||
    bultosResumen.filter((b) => b.estado === "VERIFICADO").length;
  const bultosRechazados =
    Number(dto.bultos_rechazados) ||
    bultosResumen.filter((b) => b.estado === "RECHAZADO").length;
  const bultosPendientes =
    Number(dto.bultos_pendientes) ||
    totalBultos - (bultosVerificados + bultosRechazados);

  // Estado del documento (ciclo formal legal)
  const documentoEstado = dto.estado;

  // Progreso operacional de los bultos (ciclo físico)
  const progresoOperacional = {
    total: totalBultos,
    verificados: bultosVerificados,
    rechazados: bultosRechazados,
    pendientes: bultosPendientes,
    completado: totalBultos > 0 && bultosPendientes === 0,
    resumenTexto: `${bultosVerificados + bultosRechazados} de ${totalBultos} bultos controlados`,
  };

  return {
    numero: dto.numero,
    origenId: dto.origen_id,
    destinoId: dto.destino_id,
    fechaEmision: dto.fecha_emision,
    estado: dto.estado,
    documentoEstado,
    progresoOperacional,
    totalBultos,
    bultosVerificados,
    bultosRechazados,
    bultosPendientes,
    bultosResumen,
    bultosIds: dto.bultos_ids || bultosResumen.map((b) => b.id),
    bultos: (dto.bultos || []).map(mapBultoToUI),
  };
}
