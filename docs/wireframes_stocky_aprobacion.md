# Stocky ERP: wireframes estructurales aprobados

> Complementos normativos de esta propuesta: [arquitectura UI operativa detallada](arquitectura_ui_operativa_detallada.md) para fichas, máquinas de estado, Kanban, componentes y pruebas; y [reportes PDF profesionales](reportes_pdf_profesionales.md) para R1/R2 y exportación formal. Ante una diferencia, prevalece el documento detallado más reciente.
>
> Revisión navegable: [prototipo estructural Stocky](prototipo_wireframes_stocky.html). Es un artefacto de aprobación y no modifica el frontend productivo.

**Estado:** aprobado para implementación el 20 de octubre de 2026.

Esta propuesta reemplaza la dirección visual anterior; `frontend/DESIGN.md` y `specs/001-stocky-operational-ux/` contienen el contrato vigente.

El flujo crítico de órdenes, bultos, precintos, remitos, despacho, recepción y consulta en vivo se detalla en [flujo_core_logistico_ui.md](flujo_core_logistico_ui.md).

**Resultado de la ronda:** quedaron aprobadas la arquitectura de información, jerarquía, patrones de pantalla, cantidad de pasos y sistema visual base. Las microinteracciones y el acabado final se validan sobre la interfaz real.

## 1. Reglas estructurales comunes

- Una sola aplicación web responsive.
- Administrador: experiencia desktop-first y acceso a todas las acciones.
- Repartidor/Operador general: experiencia mobile-first con sólo trabajo asignado, siguiente acción válida e historial.
- El origen y el destino se eligen dentro de cada proceso; no existe una sede global que cambie silenciosamente el significado de toda la aplicación.
- Altas y ediciones de maestros usan drawer lateral.
- Procesos con varios pasos, impacto de stock o documentos usan página completa.
- Un remito completo por orden. No se emite ni despacha hasta empaquetar toda la orden y precintar todos los bultos.
- Las validaciones de campo son inline. Los toasts confirman operaciones exitosas; no reemplazan errores de formulario.
- Cada acción irreversible explica qué registra, qué cambia y cuál será el siguiente estado.
- Inicio es un único panel de control del Administrador: alertas, trabajo pendiente, últimos movimientos y carga del ciclo operativo.
- El Administrador puede seleccionar varios productos y actualizar un atributo permitido mediante una revisión masiva previa.
- Órdenes, remitos y bultos tienen fichas enlazadas con estado actual, historial completo y siguiente acción.

## 2. Arquitectura de información propuesta

```text
Stocky
|
+-- Inicio
|   +-- Trabajo pendiente
|   +-- Alertas y notificaciones
|   `-- Últimos movimientos
|
+-- Maestros
|   +-- Productos
|   +-- Categorías
|   +-- Proveedores
|   `-- Centros y locales
|
+-- Inventario
|   +-- Stock por ubicación
|   +-- Ingresos al CD
|   +-- Alertas de reposición
|   `-- Movimientos
|
+-- Distribución
|   +-- Necesidades
|   +-- Órdenes
|   +-- Empaquetado
|   `-- Remitos y despacho
|
+-- Recepción
|   +-- Pendientes de recibir
|   `-- Historial de recepciones
|
+-- Ventas y caja [Administrador]
|   +-- Punto de venta
|   +-- Comprobantes y caja
|   `-- Devoluciones
|
`-- Control [Administrador]
    +-- Trazabilidad
    +-- Reportes
    `-- Exportaciones PDF
```

El Operador no recibe esta sidebar. Su navegación se reduce a `Trabajo`, `Historial` y `Cuenta`.

## T1. Shell y panel operativo del Administrador

```text
+----------------------+-------------------------------------------------------------------+
| STOCKY               | Buscar SKU, orden, remito o precinto...  Inbox  Admin             |
|----------------------|-------------------------------------------------------------------|
| Inicio               | Panel de control                         Actualizado 10:45          |
|                      | Todo el trabajo relevante, sin cambiar de dashboard               |
| Maestros           > |-------------------------------------------------------------------|
| Inventario         > | ALERTAS ACCIONABLES             TRABAJO PENDIENTE                 |
| Distribución       > | 4 stock bajo mínimo             3 recepciones por controlar       |
| Recepción          > | 2 órdenes sin disponibilidad    2 órdenes listas para empaquetar  |
| Ventas y caja      > | [Ver alertas filtradas]         [Abrir cola priorizada]           |
| Control            > |-------------------------------------------------------------------|
|                      | CARGA DEL CICLO                                                    |
|                      | Necesidades 12 | Preparación 4 | Tránsito 6 | Recepción 3          |
|                      | Cada etapa abre su lista filtrada y conserva el contexto.           |
|                      |-------------------------------------------------------------------|
|                      | ÚLTIMOS MOVIMIENTOS                         [Ver trazabilidad]       |
|                      | 10:42 RMT-084 despachado   CD Norte -> Local Centro  M. Gómez       |
|                      | 10:31 BLT-392 verificado  Local Sur                  A. Ruiz         |
|                      | 10:18 OR-482 confirmada   CD Oeste -> Local Norte    L. Pérez        |
+----------------------+-------------------------------------------------------------------+
```

**Decisión propuesta:** Inicio es el único panel de control. Prioriza alertas y tareas reales, muestra el estado del ciclo y conserva los últimos movimientos. Cada número es un acceso directo a evidencia filtrada; no hay tarjetas decorativas ni dashboards paralelos.

## T2. Listado de maestro con alta/edición en drawer

```text
+----------------------+---------------------------------------------------------------+
| Sidebar Admin        | Productos                                      [Nuevo producto]|
|                      | Buscar...  Categoría v  Proveedor v  Estado v                  |
|                      |---------------------------------------------------------------|
|                      | [ ] SKU      Producto       Categoría   Precio   Stock  Estado  |
|                      | [ ] ALM-001  Aceite 1,5 L   Almacén     $...     4 sedes Activo |
|                      | [ ] BEB-014  Agua 2 L       Bebidas     $...     6 sedes Activo |
|                      |-----------------------------------------------------+-----------|
|                      | Seleccionados: 2  [Actualizar atributo v]           | DRAWER    |
|                      |                                                     | Nuevo     |
|                      |                                                     | producto  |
|                      |                                                     | SKU       |
|                      |                                                     | Nombre    |
|                      |                                                     | Categoría |
|                      |                                                     | Proveedor |
|                      |                                                     | Costo     |
|                      |                                                     | Precio    |
|                      |                                                     | Mínimo    |
|                      |                                                     |-----------|
|                      |                                                     | Cancelar  |
|                      |                                                     | [Crear]   |
+----------------------+-----------------------------------------------------+-----------+
```

**Patrón:** drawer para altas y ediciones breves sin perder el contexto de la lista. La actualización masiva tiene revisión propia; no reutiliza el drawer de un registro.

### T2.1 Revisión de actualización masiva

```text
Productos / Actualización masiva                     24 productos seleccionados

Atributo a modificar  [ Precio de venta v ]
Modo                  (o) Nuevo valor  ( ) Aumentar %  ( ) Disminuir %
Valor                  [ $ 2.450,00________________ ]

SKU       Producto                 Valor anterior   Valor propuesto   Validación
ALM-001   Aceite de girasol        $ 2.100,00       $ 2.450,00       Correcto
BEB-014   Agua mineral             $ 1.900,00       $ 2.450,00       Correcto
LAC-008   Leche entera             $ 2.600,00       $ 2.450,00       Advertencia
...

Resumen: 24 cambiarán | 1 advertencia | 0 errores
[Volver a selección]                                      [Confirmar 24 cambios]
```

**Atributos permitidos:** precio, nivel mínimo, categoría, proveedor y estado activo. Cada operación modifica un solo atributo, muestra antes/después y es atómica: si queda un error, no cambia ningún producto.

## T3. Orden de reposición en página completa

```text
Órdenes / Nueva orden

  1 Necesidades -------- 2 Origen y cantidades -------- 3 Revisar y crear

+--------------------------------------------+------------------------------+
| NECESIDADES PARA LOCAL CENTRO              | RESUMEN FIJO                 |
| Buscar SKU o producto                      | Destino: Local Centro        |
|                                            | Origen: CD Norte             |
| [x] ALM-001  Solicitado 20  Urgencia alta  | 3 productos                  |
| [x] BEB-014  Solicitado 12  Urgencia media | 47 unidades                  |
| [x] LIM-003  Solicitado 15  Urgencia media |                              |
|                                            | Regla: una orden sólo puede  |
| No se muestran necesidades de otros locales| contener un destino.         |
|                                            |                              |
| [Volver]                     [Continuar]    | Sin impacto hasta confirmar  |
+--------------------------------------------+------------------------------+
```

**Patrón:** máximo tres pasos para crear la orden. La preparación, el despacho y la recepción ocurren luego desde el detalle, porque suceden en momentos y lugares distintos.

## T4. Empaquetado, precintado y remito completo

```text
Orden OR-00482   CD Norte -> Local Centro   En preparación

Preparación  [======== 68% ========------]  32 de 47 unidades empaquetadas

+----------------------------+-----------------------------------------------+
| PENDIENTE DE EMPAQUETAR     | BULTOS DE ESTA ORDEN                          |
| ALM-001  faltan 5           | BLT-001  20 u.  Precinto PR-882  Listo        |
| BEB-014  completo           | BLT-002  12 u.  Sin precinto    [Precintar]   |
| LIM-003  faltan 10          |                                               |
|                            | [+ Crear bulto]                                |
| No puede exceder el stock   |-----------------------------------------------|
| disponible del CD origen.   | REMITO                                        |
|                            | Bloqueado: faltan 15 unidades y un precinto.   |
|                            | [Emitir único remito]                          |
+----------------------------+-----------------------------------------------+
```

**Patrón:** página de trabajo persistente. Puede guardarse el avance, pero la interfaz explica por qué el remito sigue bloqueado. No hay despacho parcial.

## T5. Inicio móvil del Repartidor/Operador

```text
+----------------------------------+
| Stocky                 Operador  v|
| Mi trabajo de hoy                 |
| 5 tareas pendientes               |
|----------------------------------|
| AHORA                             |
| RMT-084                           |
| CD Norte -> Local Centro          |
| Revisar 3 bultos y despachar      |
| Registra la salida y comienza la  |
| custodia en tránsito.             |
| [Abrir tarea]                     |
|----------------------------------|
| DESPUÉS                           |
| RMT-079  Recibir en Local Sur     |
| RMT-081  Verificar 2 precintos    |
|----------------------------------|
| Trabajo       Historial     Cuenta|
+----------------------------------+
```

### T5.1 Acción móvil con consecuencia explícita

```text
+----------------------------------+
| < RMT-084            Paso 1 de 2 |
| CD Norte -> Local Centro          |
|----------------------------------|
| Revisar antes de despachar        |
| 3 de 3 bultos presentes           |
| 3 de 3 precintos coinciden        |
|                                  |
| [x] BLT-201  PR-882               |
| [x] BLT-202  PR-883               |
| [x] BLT-203  PR-884               |
|----------------------------------|
| Esta acción registra la salida de |
| los 3 bultos y los pasa a         |
| En tránsito. No acredita stock en |
| el local destino.                 |
|                                  |
| [Confirmar despacho]              |
+----------------------------------+
```

**Patrón:** una tarea abre directamente en su siguiente acción válida. No hay sidebar, gráficos ni controles administrativos.

## T6. Recepción y verificación de precinto

```text
+----------------------------------+
| < Recepción RMT-084              |
| Local Centro                     |
| 2 de 3 bultos controlados        |
|----------------------------------|
| BLT-203                           |
| Precinto esperado                |
| PR-884                            |
|                                  |
| Código observado                 |
| [ PR-884______________________ ]  |
|                                  |
| Estado del precinto              |
| (o) Intacto                      |
| ( ) Violado o diferente          |
|----------------------------------|
| Si está intacto, este bulto queda|
| verificado. El stock se acredita |
| sólo al cerrar el remito completo.|
|                                  |
| [Guardar control]                |
+----------------------------------+
```

**Resultado intacto:** muestra `Verificado`, quién lo controló y la hora.

**Resultado violado:** exige motivo, muestra `Rechazado` y explica que se registrará merma sin acreditar stock vendible.

## T7. Detalle único y trazabilidad

```text
+--------------------------------------------------------------------------------+
| Buscar orden, remito, bulto, precinto o SKU...                   [Buscar]        |
|--------------------------------------------------------------------------------|
| Remito RMT-084   En tránsito          CD Norte -> Local Centro                  |
| Orden OR-00482 | 3 bultos | 47 unidades | Responsable actual: M. Gómez          |
|                                                                                |
| Siguiente acción: registrar recepción en Local Centro       [Abrir recepción]  |
|--------------------------------------------------------------------------------|
| CADENA DOCUMENTAL                                                              |
| Necesidades -> OR-00482 -> RMT-084 -> BLT-201 / 202 / 203 -> Precintos         |
|                 [Abrir orden]  [actual]  [Abrir bulto específico]               |
|--------------------------------------------------------------------------------|
| ESTADO DEL FLUJO                                                               |
| Confirmada -> Preparación -> Precintada -> Despachada -> En tránsito -> ...     |
|--------------------------------------------------------------------------------|
| HISTORIAL INMUTABLE                                      [Filtrar eventos v]    |
| 19 oct 10:42  Despachado     M. Gómez   CD Norte       Documento RMT-084        |
| 19 oct 10:31  Remito emitido L. Pérez   RMT-084        3 bultos                 |
| 19 oct 10:18  Precintado     M. Gómez   BLT-203        Precinto PR-884          |
|--------------------------------------------------------------------------------|
| CONTENIDO                                                                      |
| SKU       Producto              Pedido  Empaquetado  Verificado  Merma           |
| ALM-001   Aceite 1,5 L          20      20           -           -               |
+--------------------------------------------------------------------------------+
```

**Patrón:** una ficha concentra estado, siguiente acción, relaciones documentales y eventos. La búsqueda global admite SKU, orden, remito, bulto y precinto. Abrir un vínculo conserva filtros y permite volver al punto anterior.

### T7.1 Seguimiento de un bulto específico

```text
Bulto BLT-203   En tránsito                  Precinto PR-884
Orden OR-00482 -> Remito RMT-084 -> Local Centro

Preparado       09:54  M. Gómez  CD Norte
Precintado      10:18  M. Gómez  PR-884 coincide
En tránsito     10:42  M. Gómez  RMT-084
Recibido        Pendiente
Verificado      Pendiente

Contenido: 3 productos, 15 unidades
Stock: reservado en origen -> en tránsito -> pendiente de verificación
[Abrir orden] [Abrir remito] [Ver movimientos de stock]
```

La misma estructura se usa para una Orden o un Remito: resumen estable, progreso, relaciones, historial completo, contenido e impacto de stock.

## T8. Ventas y Caja: UI integrada al backend operativo

```text
+------------------------------------------+--------------------------------+
| PRODUCTOS DEL LOCAL                      | VENTA ACTUAL                   |
| Buscar SKU o nombre                      | Aceite 1,5 L      2   $...     |
|                                          | Agua 2 L          1   $...     |
| ALM-001 Aceite 1,5 L  Stock 16 [Agregar] |--------------------------------|
| BEB-014 Agua 2 L       Stock 8  [Agregar] | Subtotal                 $...  |
|                                          | Medio de pago                 |
|                                          | (o) Efectivo ( ) Tarjeta      |
|                                          | ( ) Transferencia             |
|                                          |--------------------------------|
|                                          | Impacto esperado              |
|                                          | Stock: -3 u.  Caja: +$...     |
|                                          | [Revisar y cobrar]            |
+------------------------------------------+--------------------------------+
```

Comprobantes, caja y devoluciones mantienen el mismo patrón: lista, detalle y acción contextual. La UI consume `/api/ventas` y `/api/caja`, conserva lo ingresado ante errores y sólo confirma una operación después de la respuesta persistida.

## T9. Reportes operativos y exportación PDF

```text
+----------------------+-------------------------------------------------------+
| Control              | Salud de stock                                       |
| > Trazabilidad       | Período [Este mes v] Centro/Local [Todos v]           |
| > Reportes           | Actualizado 19 oct 10:45           [Exportar PDF]      |
| > Exportaciones      |-------------------------------------------------------|
|                      | HALLAZGOS PRIORITARIOS                                |
|                      | 12 productos bajo mínimo  [Ver detalle filtrado]       |
|                      |  3 productos agotados      [Ver detalle filtrado]      |
|                      |-------------------------------------------------------|
|                      | DETALLE                                                |
|                      | Producto | Ubicación | Disponible | Mínimo | Acción     |
+----------------------+-------------------------------------------------------+
```

### PDF formal

```text
+--------------------------------------------------------------------------+
| STOCKY | Salud de stock                         Emitido: 19/10/2026 10:45 |
| Período: octubre | Ubicaciones: todas | Responsable: Administrador        |
|--------------------------------------------------------------------------|
| Resumen de hallazgos                                                    |
| Detalle y evidencia                                                     |
|                                                                          |
|                                                       Página 1 de N      |
+--------------------------------------------------------------------------+
| Apéndice apaisado: tablas anchas, encabezado repetido y columnas legibles|
+--------------------------------------------------------------------------+
```

El PDF incluye sólo el reporte activo y sus filtros. No imprime sidebar, botones, pestañas inactivas ni espacios del dashboard.

## 3. Sistema visual propuesto

La dirección reemplaza el violeta y la acumulación de píldoras de la UI actual por una base sobria, clara y orientada a lectura prolongada. El color identifica acciones y estados; no decora contenedores.

### 3.1 Paleta

| Rol | Token | Valor | Uso |
|---|---|---:|---|
| Fondo general | `canvas` | `#F4F4F2` | Área de trabajo, reduce el blanco brillante. |
| Superficie | `surface` | `#FFFFFF` | Tablas, drawers, barras y contenido principal. |
| Superficie secundaria | `surface-muted` | `#EDEDEB` | Filtros, encabezados de tabla y selección suave. |
| Sidebar | `nav` | `#111214` | Navegación estable y profesional. |
| Texto principal | `ink` | `#151619` | Títulos, datos y acciones de alta prioridad. |
| Texto secundario | `ink-muted` | `#5F6065` | Etiquetas, metadatos y ayudas. |
| Borde | `line` | `#D7D7D3` | Divisiones y controles; sin sombras innecesarias. |
| Acción primaria | `action` | `#17181B` | Botón principal, selección y foco. |
| Acción hover | `action-strong` | `#2B2C30` | Hover y pressed de la acción primaria. |
| Información | `info` | `#315F82` | Estados informativos y enlaces. |
| Correcto | `success` | `#316B49` | Verificado, cerrado y disponible. |
| Atención | `warning` | `#8A611D` | Bajo mínimo, pendiente o en tránsito. |
| Crítico | `danger` | `#A23B35` | Rechazado, merma, agotado y acción destructiva. |

**Reglas de color:** fondo claro como modo principal; textos con contraste WCAG AA; cada estado combina color, texto e icono; las tablas no colorean filas completas salvo selección; máximo una acción primaria visible por región.

### 3.2 Tipografía

- Familia: `Inter Variable`, servida localmente, con `system-ui` como fallback.
- Títulos de página: 28 px / 34 px, peso 600.
- Títulos de sección: 20 px / 28 px, peso 600.
- Cuerpo y controles: 14 px / 20 px, pesos 400 y 500.
- Datos secundarios: 12 px / 16 px, peso 400; nunca por debajo de 12 px.
- Botones: verbo específico en sentence case, 14 px, peso 500.
- No se usan mayúsculas sostenidas, eyebrow labels ni una fuente monoespaciada como decoración.

### 3.3 Números, importes, fechas e identificadores

- Todos los datos comparables usan `font-variant-numeric: tabular-nums`.
- Importes en formato argentino: `$ 1.250.000,00`.
- Unidades: `1.248 u.`; porcentajes: `12,5 %`.
- Números y montos se alinean a la derecha en tablas; identificadores y texto, a la izquierda.
- Fecha completa: `19 oct 2026, 10:42`; tiempo relativo sólo como apoyo: `hace 8 min`.
- Identificadores no se traducen ni abrevian: `OR-00482`, `RMT-2026-0084`, `BLT-203`, `PR-884`.
- Cero real se muestra como `0`; dato inexistente como `No disponible`; una celda no usa `-` si puede resultar ambigua.

### 3.4 Geometría y densidad

- Retícula base de 8 px; separación interna mínima de 4 px sólo en grupos compactos.
- Sidebar desktop: 240 px; topbar: 64 px; contenido fluido con máximo de 1600 px.
- Fila de tabla cómoda: 48 px; compacta: 40 px. La elección se conserva por usuario.
- Drawer de maestro: 440-520 px; cuerpo desplazable y acciones siempre visibles.
- Controles desktop: mínimo 36 px; objetivos táctiles del Operador: mínimo 48 px.
- Radios: 8 px en controles, 12 px en paneles y 16 px en overlays. Las píldoras se reservan para estados y filtros.
- Bordes de 1 px; sombra sólo en overlays flotantes. Las secciones del panel se separan por jerarquía y divisores, no por tarjetas anidadas.

### 3.5 Iconografía y movimiento

- Iconos de línea consistentes, 18-20 px, con etiqueta visible en acciones críticas.
- Duración base: 160-200 ms; movimiento corto y sin rebote.
- Drawers entran lateralmente; cambio de paso conserva posición y contexto; toasts no desplazan contenido.
- `prefers-reduced-motion` elimina desplazamientos y conserva sólo cambios instantáneos de estado.

## 4. Estados obligatorios en todos los tipos

| Estado | Tratamiento propuesto |
|---|---|
| Cargando | Esqueleto con la geometría real de la pantalla; acciones deshabilitadas. |
| Vacío | Explica por qué no hay datos y ofrece una acción pertinente. |
| Error recuperable | Mensaje concreto, datos ingresados preservados y acción `Reintentar`. |
| Validación | Mensaje junto al campo y resumen sólo cuando hay varios errores. |
| Acción bloqueada | Botón deshabilitado más la condición faltante y la siguiente acción válida. |
| Éxito | Toast breve y actualización visible del estado afectado. |
| Sin permiso | La acción no aparece para Operador; el Administrador conserva acceso total. |

## 5. Criterio de aprobación

La aprobación de estos wireframes confirma:

1. Arquitectura de información y sidebar del Administrador.
2. Navegación móvil reducida del Operador.
3. Drawers para maestros y páginas completas para procesos complejos.
4. Secuencia Orden -> Empaquetado -> Remito único -> Despacho -> Recepción -> Cierre.
5. Estructura de Ventas/Caja integrada al contrato persistido oficial.
6. Separación entre reporte interactivo y PDF formal.
7. Panel de control único con alertas, pendientes, ciclo y últimos movimientos.
8. Actualización masiva de un atributo con revisión antes/después.
9. Trazabilidad navegable de órdenes, remitos y bultos.
10. Paleta, tipografía, formato numérico, densidad y reglas de interacción propuestas.

La aprobación confirma esta base visual. La implementación todavía deberá validar contraste real, responsive, estados, teclado y legibilidad con datos extremos antes de considerarse final.
