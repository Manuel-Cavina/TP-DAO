# Framework operativo centrado en la orden

## Principio

La orden es el contenedor único de la operación. Bultos, precintos, remito, despacho, recepción y excepciones se consultan y accionan desde ella. Los tableros sólo son bandejas de trabajo y las tablas históricas sólo sirven para consultar.

## Sidebar

1. Inicio: panel de control operativo.
2. Catálogo: productos, categorías, proveedores y centros/locales.
3. Ventas y caja: punto de venta, comprobantes/caja y devoluciones.
4. Operaciones: tablero operativo, reposición pendiente, distribución, empaquetado, remitos/despacho y recepción.
5. Inventario: inventario por sede, recepción de proveedores y reposición.
6. Control: trazabilidad, reportes y exportaciones.

## Pantalla Operaciones

- Tablero de trabajo: sólo órdenes activas, agrupadas por próxima acción: preparar, empaquetar, falta precinto, lista para remito, en tránsito.
- Lista histórica: tabla con filtros de estado, origen, destino y fecha. Cerradas y recibidas sólo aparecen aquí.
- Recepción: bandeja de remitos esperados y recibidos; el historial se consulta en una pestaña separada.
- Reposición pendiente: necesidades que aún no se convirtieron en orden. Al crearla desaparecen de esa bandeja y pasan al tablero.

## Detalle de orden

Siempre conserva una cabecera breve: OR, origen, destino, estado, responsable y la única próxima acción posible.

| Pestaña | Contenido | Acción por estado |
| --- | --- | --- |
| Resumen | renglones, cantidades y línea de tiempo | crear bulto cuando está pendiente |
| Empaque y precintos | bultos de esta orden y sus precintos | crear bulto, precintar, aprobar |
| Remito y despacho | remito generado, bultos incluidos y salida | generar remito, despachar |
| Recepción | control de bultos de destino y diferencias | recibir, verificar o rechazar |
| Historial | eventos inmutables y responsables | sólo consulta |

La acción primaria avanza a la pestaña correspondiente. Las acciones que no aplican al estado actual no se muestran.

## Estados y bandejas

| Estado de la orden | Bandeja | Próxima acción |
| --- | --- | --- |
| Pendiente | Por preparar | Abrir Empaque y precintos |
| En preparación | Empaquetando / Falta precinto | Completar bultos o precintar |
| Lista para remito | Para remito | Generar remito |
| Despachada | En tránsito | Gestionar recepción |
| Cerrada | Historial | Ver detalle |

## Recepción de proveedores

Una recepción exige una orden formal. Inventario sólo muestra el resultado y enlaza a la orden; no ofrece altas manuales de stock.
