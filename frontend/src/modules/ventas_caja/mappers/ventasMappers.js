import { AppError } from "../../../core/http/AppError.js";

const PAYMENT_TYPES = {
  Pago_Efectivo: "EFECTIVO",
  Pago_Tarjeta: "TARJETA",
  Pago_Transferencia: "TRANSFERENCIA",
};

function validationError(message) {
  return new AppError({ kind: "validation", message });
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > 100_000) {
    throw validationError(`${label} debe ser un entero entre 1 y 100000.`);
  }
  return number;
}

export function mapVentaToUI(dto) {
  const subtotal = Number(dto?.total) || 0;
  const total = Number(dto?.total_cobrado ?? dto?.total) || 0;
  return {
    id: dto?.id,
    ventaId: dto?.id,
    numero: dto?.numero_comprobante || `Venta #${dto?.id}`,
    localId: dto?.local_id,
    fecha: dto?.fecha_hora,
    cliente: "Consumidor final",
    medioPago: dto?.medio_pago,
    subtotal,
    recargo: Math.max(0, total - subtotal),
    total,
    detalles: (dto?.detalles || []).map(mapDetalleToUI),
  };
}

export function mapComprobanteToUI(dto) {
  const subtotal = Number(dto?.total) || 0;
  return {
    id: dto?.venta_id,
    ventaId: dto?.venta_id,
    numero: dto?.numero_formateado,
    localId: dto?.local_id,
    fecha: dto?.fecha_emision,
    cliente: "Consumidor final",
    medioPago: dto?.medio_pago,
    subtotal,
    recargo: Number(dto?.recargo) || 0,
    total: Number(dto?.total_cobrado) || subtotal,
    vuelto: Number(dto?.vuelto) || 0,
    detalles: (dto?.items || []).map(mapDetalleToUI),
  };
}

export function mapDevolucionToUI(dto, venta) {
  return {
    id: dto?.id,
    ventaId: dto?.venta_id,
    numero: `DEV-${String(dto?.id || "").padStart(6, "0")}`,
    facturaNumero: venta?.numero || `Venta #${dto?.venta_id}`,
    localId: dto?.local_id,
    fecha: dto?.fecha_hora,
    motivo: dto?.motivo,
    medioReintegro: dto?.medio_pago,
    totalReintegro: Number(dto?.monto_reintegrado) || 0,
    items: (dto?.detalles || []).map((item) => ({
      ...mapDetalleToUI(item),
      subtotal: Number(item?.monto) || 0,
    })),
  };
}

export function mapCajaToUI(dto) {
  return {
    localId: dto?.local_id,
    desde: dto?.desde,
    hasta: dto?.hasta,
    cantidadVentas: Number(dto?.cantidad_ventas) || 0,
    totalVentas: Number(dto?.total_ventas) || 0,
    cantidadDevoluciones: Number(dto?.cantidad_devoluciones) || 0,
    totalDevoluciones: Number(dto?.total_devoluciones) || 0,
    saldo: Number(dto?.saldo) || 0,
  };
}

export function mapCheckoutToDTO(form) {
  const localId = positiveInteger(form?.localId, "El local");
  if (!Array.isArray(form?.items) || form.items.length === 0) {
    throw validationError("Agrega al menos un producto antes de cobrar.");
  }

  const items = form.items.map((item) => ({
    producto_id: positiveInteger(item?.productoId, "El producto"),
    cantidad: positiveInteger(item?.cantidad, "La cantidad"),
  }));
  const medio = PAYMENT_TYPES[form?.medioPago];
  if (!medio) throw validationError("Selecciona un medio de pago válido.");

  let pago;
  if (medio === "EFECTIVO") {
    const montoTexto = String(form?.efectivoRecibido ?? "").trim();
    const montoNormalizado = montoTexto.replace(",", ".");
    const montoRecibido = Number(montoNormalizado);
    const total = Number(form?.total);
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(montoTexto) || !Number.isFinite(montoRecibido) || montoRecibido <= 0) {
      throw validationError("Ingresa el monto recibido en efectivo.");
    }
    if (Number.isFinite(total) && montoRecibido < total) {
      throw validationError("El efectivo recibido no puede ser menor al total.");
    }
    pago = { medio, monto_recibido: montoNormalizado };
  } else if (medio === "TARJETA") {
    const numeroTarjeta = String(form?.numeroTarjeta || "").replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(numeroTarjeta)) {
      throw validationError("La tarjeta debe tener entre 13 y 19 dígitos.");
    }
    const cuotas = Number(form?.cuotas);
    if (![1, 3, 6, 12].includes(cuotas)) {
      throw validationError("Selecciona 1, 3, 6 o 12 cuotas.");
    }
    pago = { medio, numero_tarjeta: numeroTarjeta, cuotas };
  } else {
    const destino = String(form?.cbuOAlias || "").trim();
    const codigo = String(form?.codigoTransaccion || "").trim();
    const validCbu = /^\d{22}$/.test(destino);
    const validAlias = /^(?=.*[A-Za-z.-])[A-Za-z0-9.-]{6,20}$/.test(destino);
    if (!validCbu && !validAlias) {
      throw validationError("Ingresa un CBU de 22 dígitos o un alias válido de 6 a 20 caracteres.");
    }
    if (!codigo) throw validationError("Ingresa el código de la transferencia.");
    pago = { medio, cbu_o_alias: destino, codigo_transaccion: codigo };
  }

  return { local_id: localId, items, pago };
}

export function mapDevolucionToDTO(form) {
  const motivo = String(form?.motivo || "").trim();
  if (motivo.length > 255) throw validationError("El motivo admite hasta 255 caracteres.");
  if (!motivo) throw validationError("Indica el motivo de la devolución.");
  if (!Array.isArray(form?.items) || form.items.length === 0) {
    throw validationError("Selecciona al menos un producto para devolver.");
  }
  return {
    ventaId: positiveInteger(form?.ventaId, "La venta"),
    payload: {
      local_id: positiveInteger(form?.localId, "El local"),
      motivo,
      items: form.items.map((item) => ({
        producto_id: positiveInteger(item?.productoId, "El producto"),
        cantidad: positiveInteger(item?.cantidad, "La cantidad"),
      })),
    },
  };
}

function mapDetalleToUI(item) {
  return {
    productoId: item?.producto_id,
    codigo: `ID ${item?.producto_id}`,
    nombre: `Producto #${item?.producto_id}`,
    cantidad: Number(item?.cantidad) || 0,
    precio: Number(item?.precio_unitario) || 0,
    subtotal: Number(item?.subtotal) || 0,
  };
}
