# Ventas y caja

Interfaz persistente para ventas, cobros, comprobantes internos no fiscales, devoluciones y saldo por período y local.

Consume los contratos oficiales `/api/ventas` y `/api/caja/{local_id}`. El backend es la
fuente de verdad para precios, stock, recargos, montos reintegrables y saldo de caja.

Stocky registra la operación interna; la confirmación de tarjeta, transferencia y devolución de fondos ocurre fuera del sistema hasta completar T086-T087.
