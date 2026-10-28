import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mapCajaToUI,
  mapCheckoutToDTO,
  mapComprobanteToUI,
  mapDevolucionToDTO,
} from "../src/modules/ventas_caja/mappers/ventasMappers.js";

const base = {
  localId: 2,
  total: 100,
  items: [{ productoId: 7, cantidad: 2 }],
};

assert.deepEqual(
  mapCheckoutToDTO({ ...base, medioPago: "Pago_Efectivo", efectivoRecibido: 120 }),
  {
    local_id: 2,
    items: [{ producto_id: 7, cantidad: 2 }],
    pago: { medio: "EFECTIVO", monto_recibido: "120" },
  }
);
assert.throws(
  () => mapCheckoutToDTO({ ...base, medioPago: "Pago_Efectivo", efectivoRecibido: 99 }),
  /menor al total/
);
assert.throws(
  () => mapCheckoutToDTO({ ...base, medioPago: "Pago_Efectivo", efectivoRecibido: "120.123" }),
  /monto recibido/
);
assert.throws(
  () => mapCheckoutToDTO({ ...base, items: [{ productoId: 7, cantidad: 100_001 }], medioPago: "Pago_Efectivo", efectivoRecibido: 120 }),
  /entre 1 y 100000/
);
assert.deepEqual(
  mapCheckoutToDTO({
    ...base,
    medioPago: "Pago_Tarjeta",
    numeroTarjeta: "4111111111111111",
    cuotas: 3,
  }).pago,
  { medio: "TARJETA", numero_tarjeta: "4111111111111111", cuotas: 3 }
);
assert.deepEqual(
  mapCheckoutToDTO({
    ...base,
    medioPago: "Pago_Transferencia",
    cbuOAlias: "stocky.caja",
    codigoTransaccion: "TRX-1",
  }).pago,
  { medio: "TRANSFERENCIA", cbu_o_alias: "stocky.caja", codigo_transaccion: "TRX-1" }
);

assert.deepEqual(
  mapDevolucionToDTO({
    ventaId: 4,
    localId: 2,
    motivo: "Producto fallado",
    items: [{ productoId: 7, cantidad: 1 }],
  }),
  {
    ventaId: 4,
    payload: {
      local_id: 2,
      motivo: "Producto fallado",
      items: [{ producto_id: 7, cantidad: 1 }],
    },
  }
);

assert.equal(mapCajaToUI({ saldo: "42.50" }).saldo, 42.5);
assert.equal(
  mapComprobanteToUI({ venta_id: 4, total: "100", total_cobrado: "110", recargo: "10" }).total,
  110
);

const serviceSource = readFileSync(
  new URL("../src/modules/ventas_caja/services/ventasService.js", import.meta.url),
  "utf8"
);
assert.match(serviceSource, /const venta = await http\.post/);
assert.match(serviceSource, /catch \{[\s\S]*return mapVentaToUI\(venta\)/);

console.log("Ventas y caja respeta el contrato HTTP y sus validaciones críticas.");
