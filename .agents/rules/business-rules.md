# Reglas críticas de negocio

- El stock de un local solo queda disponible cuando el bulto y el remito están verificados.
- Precinto violado implica bulto rechazado: no acredita stock vendible.
- El ciclo del bulto es secuencial e inmutable: preparado, precintado, en tránsito, recibido, verificado o rechazado.
- Una venta no supera el stock disponible y verificado del local.
- Producto y proveedor no pueden duplicarse según su identificador definido.
- Una devolución debe referenciar una venta registrada y actualizar stock y caja de manera consistente.
