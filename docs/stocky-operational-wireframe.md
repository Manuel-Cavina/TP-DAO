# Wireframe de migración: operación centrada en la orden

## Decisión de navegación

El sidebar final queda en este orden y sólo agrupa destinos de primer nivel:

1. **Inicio**: panel de control operativo.
2. **Operaciones**: tablero de trabajo, reposición pendiente, órdenes, empaquetado, remitos y recepción.
3. **Ventas y caja**: punto de venta, comprobantes/caja y devoluciones.
4. **Inventario**: inventario por sede, movimientos recientes y reposición.
5. **Catálogo**: productos, categorías, proveedores, centros y locales.
6. **Control**: trazabilidad, reportes y exportaciones.

## Estructura de Operaciones

El tablero operativo existente se conserva como está. No se rediseñan ni se eliminan sus columnas; se usa como la vista principal para entender el trabajo vivo.

```
OPERACIONES
  [Tablero operativo actual] [Distribución] [Empaquetado] [Remitos y despacho] [Recepción]

  Tablero operativo actual
  ┌ Por preparar ┬ Empaquetando ┬ Falta precinto ┬ Para remito ┬ En tránsito ┐
  │ OR-000006    │ OR-000008    │ OR-000007      │ OR-000010   │ OR-000013   │
  │ próxima acción: abrir detalle de orden                                      │
  └────────────────────────────────────────────────────────────────────────────┘

  Las otras vistas son bandejas especializadas que abren la misma orden.
```

El tablero contiene únicamente trabajo activo. Las listas especializadas no son nuevos flujos: son filtros persistentes de la misma operación y cada fila abre el mismo detalle de OR.

## Sidebar de Operaciones

```
Inicio
Operaciones
  Tablero operativo          ← se conserva exactamente como hoy
  Distribución               ← órdenes activas y cerradas, filtro de origen/destino
  Empaquetado                ← sólo OR que requieren bulto, precinto o aprobación
  Remitos y despacho         ← sólo OR listas para RM, emitidas o en tránsito
  Recepción                  ← sólo remitos pendientes, arribados, en verificación y cerrados
Ventas y caja
Inventario
Catálogo
Control
```

Las cuatro bandejas no duplican el tablero. Responden preguntas distintas para perfiles distintos:

| Pantalla | Pregunta que responde | Filas que muestra | Acción inmediata |
| --- | --- | --- | --- |
| Distribución | ¿Qué órdenes tengo entre CD y locales? | OR activas y consulta histórica | Abrir orden |
| Empaquetado | ¿Qué necesita armarse o precintarse ahora? | OR pendiente, en preparación o bloqueada por precinto | Abrir Empaque |
| Remitos y despacho | ¿Qué puedo documentar o enviar? | OR lista para RM, RM emitido y tránsito | Abrir Remito y despacho |
| Recepción | ¿Qué tengo que recibir o verificar en destino? | RM pendiente, arribado, en destino y en verificación | Abrir Recepción |

## Contenedor único: detalle de orden

**Regla de interacción:** las bandejas sólo ordenan el trabajo. Ninguna despacha, precinta, emite ni recibe. Su botón abre la OR y la pestaña de la etapa; la OR ejecuta la acción usando los servicios reales.

```
OR-000013 · CD Central → Local Centro · Despachada
Próxima acción: Gestionar recepción

[Resumen] [Empaque y precintos] [Remito y despacho] [Recepción] [Historial]

Resumen:         renglones, cantidades, responsables y línea de vida.
Empaque:          crear bulto, asignar cantidades, precintar y aprobar.
Remito:           bultos aprobados, RM, despacho y transporte.
Recepción:        bultos esperados, control de precinto, diferencia y aceptación.
Historial:        eventos inmutables con fecha, actor y evidencia.
```

La acción principal lleva directamente a la pestaña pertinente. No se muestran acciones imposibles para el estado actual:

| Estado | Pestaña abierta | Única acción primaria |
| --- | --- | --- |
| Pendiente | Empaque y precintos | Crear bulto |
| En preparación | Empaque y precintos | Completar o precintar |
| Lista para remito | Remito y despacho | Generar remito |
| Despachada | Recepción | Gestionar recepción |
| Cerrada | Historial | Ver trazabilidad |

Una pestaña adelantada no queda vacía ni permite una acción inválida: explica el prerequisito y muestra un único botón para volver a la etapa que lo resuelve. Por ejemplo, Recepción informa que se debe emitir y despachar el remito antes de controlar precintos.

### Wireframe de detalle, como se vería en Figma

```
┌──────────────────────────────────────────────────────────────────────────┐
│ OR-000013  CD Central → Local Centro             Despachada              │
│ 10 u. · 2 bultos · RM-000013 · Responsable: Operador de logística        │
│                                                     [Gestionar recepción] │
├──────────────────────────────────────────────────────────────────────────┤
│ Resumen | Empaque y precintos | Remito y despacho | Recepción | Historial│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ CONTENIDO DE LA PESTAÑA ACTIVA                                             │
│                                                                            │
│ Estado actual + evidencia + acción que puede resolverlo                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Contenido de cada pestaña

| Pestaña | Se ve | Se puede hacer |
| --- | --- | --- |
| Resumen | destino, renglones, cantidad solicitada/preparada/despachada/recibida y línea de vida | ir a la próxima etapa |
| Empaque y precintos | bultos de OR, contenido, precinto y aprobación | crear bulto, completar cantidad, registrar precinto, aprobar |
| Remito y despacho | bultos aprobados, RM, fecha y evidencia de salida | generar RM, emitir, despachar |
| Recepción | esperado vs recibido, control de precinto, faltantes y rechazos | marcar arribado, recibir, verificar, rechazar con motivo |
| Historial | evento, actor, fecha y objeto vinculado | sólo consulta y trazabilidad |

## Ciclo visible en cada orden

```
Preparar → Empaquetar → Precintar → Remito emitido → En tránsito
→ Arribado → En destino → En verificación → Cerrado
```

Se muestra como línea de vida en el encabezado de la OR. Las etapas pendientes quedan neutras; la actual se marca; las completas conservan fecha y responsable. Los estados que ya existen en backend se mapean primero a esta vista sin inventar transiciones. Las nuevas transiciones sólo se agregan tras validar el contrato de logística.

## Migración de pantallas

| Actual | Destino | Cambio |
| --- | --- | --- |
| Kanban de órdenes | Operaciones > Tablero activo | sólo estados con trabajo y columnas que llenan el ancho disponible |
| Órdenes y remitos mezclados | Operaciones > Historial | listas separadas por tipo y estado, filtros compartidos |
| Empaquetado separado | Detalle de orden > Empaque y precintos | la OR concentra el contexto y abre el espacio de trabajo real de empaque con retorno a la misma pestaña |
| Recepción separada | Operaciones > Recepción y Detalle > Recepción | la OR concentra el contexto y abre el control real del remito con retorno a la orden |
| Necesidades | Operaciones > Reposición pendiente | sólo necesidades sin OR; al crearla enlaza a OR |
| Movimientos | Inventario > Movimientos recientes | contexto de sede/producto; Trazabilidad conserva búsqueda transversal |
| Alta directa de stock | Retirada de las entradas principales | una recepción exige orden formal y queda registrada en la línea de vida |

## Comunicación entre pantallas

- Una tarjeta del tablero abre el detalle de su OR, no otra pantalla intermedia.
- Cada bulto, RM y recepción muestra su OR de origen como enlace persistente.
- El detalle conserva una línea de vida que conecta cantidad, bulto, precinto, remito y recepción.
- La tabla histórica usa el mismo identificador visible (`OR-000001`, `RM-000001`, `BLT-000001`) y abre el mismo detalle.
- Trazabilidad busca transversalmente, pero su resultado vuelve al detalle en la pestaña correspondiente.

## Responsividad

- **Desktop (>= 1100 px):** tablero de cinco columnas o seis si el ancho real las soporta; las columnas se distribuyen en `fr`, sin franja vacía.
- **Tablet (641-1099 px):** tablero con desplazamiento horizontal interno; tabla con campos secundarios como sublíneas.
- **Operador móvil (390 px):** una orden por fila, estado y próxima acción visibles; el detalle navega una pestaña a la vez y conserva “Volver al tablero”.

## Límite de dominio a resolver antes de migrar proveedores

La OR actual modela distribución entre CD y local. Para reemplazar de forma real la recepción manual de proveedores se necesita una **orden de abastecimiento/proveedor** o extender la OR con origen proveedor y recepción en CD. No se debe simular esa orden desde frontend: es una decisión y contrato backend previo a retirar definitivamente la API de alta manual.
