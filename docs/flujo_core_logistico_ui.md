# Stocky ERP: flujo core logístico y trazabilidad UI

**Estado:** aprobado para implementación el 20 de octubre de 2026. Este documento es normativo junto con `specs/001-stocky-operational-ux/`.

Este documento define cómo debe entenderse, ejecutarse y consultarse el ciclo crítico desde una necesidad de reposición hasta el cierre del remito. Complementa `wireframes_stocky_aprobacion.md`.

## 1. Regla central

Nada recibido en un local se convierte en stock vendible hasta que:

1. el remito haya llegado al destino;
2. cada bulto esté `Verificado` o `Rechazado`;
3. el remito se cierre formalmente.

Al cerrar el remito, un bulto verificado acredita sus unidades al stock disponible. Un bulto rechazado registra merma y nunca habilita venta.

## 2. Cadena documental

```text
Necesidades de un local
        |
        v
Orden de reposición: un origen CD + un destino Local
        |
        v
Uno o más bultos con productos y cantidades
        |
        v
Un precinto único por bulto
        |
        v
Un único remito completo por orden
        |
        v
Despacho -> Transporte -> Recepción -> Verificación -> Cierre
        |
        v
Stock disponible o merma en el local destino
```

Relaciones obligatorias:

- Una orden agrupa necesidades de un solo local destino.
- Una orden selecciona un único CD origen, pero cualquier CD activo puede abastecer cualquier local activo.
- Un bulto pertenece a una sola orden.
- Un precinto se utiliza una sola vez y en un solo bulto.
- Un remito pertenece a una sola orden e incluye todos sus bultos.
- No existe despacho parcial.

## 3. Estados que la UI debe separar

### 3.1 Orden de reposición

```text
Pendiente -> En preparación -> Despachada -> Cerrada
```

| Estado | Significado | Acción siguiente |
|---|---|---|
| Pendiente | La orden existe y aún puede iniciar su preparación. | Crear el primer bulto. |
| En preparación | Se están armando y precintando los bultos. | Completar empaque y emitir remito. |
| Despachada | El remito completo salió del CD. | Recibir y verificar en destino. |
| Cerrada | El remito fue resuelto y su stock o merma fue aplicado. | Sólo consulta y auditoría. |

### 3.2 Remito

```text
Emitido -> Despachado -> Recibido -> Cerrado
```

| Estado documental | Significado | Progreso operativo derivado |
|---|---|---|
| Emitido | Documento creado con todos los bultos precintados. | Listo para despacho. |
| Despachado | Salió del CD. | Sus bultos están en tránsito. |
| Recibido | Llegó al local. | Sus bultos esperan control o ya fueron resueltos. |
| Cerrado | Todos los bultos terminaron verificados o rechazados. | Stock y merma aplicados. |

La UI no inventa estados documentales para representar el viaje. Muestra, por ejemplo, `Remito: Despachado` y debajo `Bultos: 3 en tránsito`.

### 3.3 Bulto

```text
Preparado -> Precintado -> En tránsito -> Recibido -> Verificado
                                                   `-> Rechazado
```

| Estado | Puede hacerse | No puede hacerse |
|---|---|---|
| Preparado | Revisar contenido y asignar precinto. | Despachar o recibir. |
| Precintado | Incluir en el remito completo. | Modificar contenido. |
| En tránsito | Consultar custodia y destino. | Verificar antes del arribo. |
| Recibido | Comparar código físico e integridad. | Volver a tránsito. |
| Verificado | Consultar evidencia; acredita al cierre. | Cambiar nuevamente de estado. |
| Rechazado | Consultar motivo; registra merma al cierre. | Cambiar nuevamente de estado. |

## 4. Flujo operativo completo

### Paso 1. Consolidar necesidades y crear la orden

**Actor:** Administrador.

**Entrada:** necesidades pendientes del mismo local.

**Pantalla:** `Distribución > Necesidades` y wizard de nueva orden.

**La UI muestra:**

- local destino fijado por la primera necesidad seleccionada;
- necesidades compatibles y cantidades solicitadas;
- selector de CD origen;
- disponibilidad actual en ese CD;
- resumen fijo de productos y cantidades.

**Bloqueos:** no mezclar destinos, no usar ubicaciones inactivas, no continuar sin líneas válidas.

**Resultado:** orden `Pendiente`, enlazada con las necesidades consolidadas.

### Paso 2. Crear bultos y reservar mercadería

**Actor:** Administrador u Operador.

**Entrada:** orden `Pendiente` o `En preparación`.

**Pantalla:** detalle de orden, sección `Empaquetado`.

**La UI muestra por producto:** pedido, ya empaquetado, pendiente y disponible en el CD origen.

**Acción:** crear un bulto con uno o más productos y cantidades.

**Validaciones:**

- el producto pertenece a la orden;
- la cantidad es positiva;
- no supera la cantidad pendiente de la orden;
- no supera el stock disponible en el CD.

**Resultado:**

- al crear el primer bulto, la orden pasa a `En preparación`;
- el bulto nace `Preparado`;
- las cantidades dejan de estar disponibles en el CD para otra operación.

**Nota de contrato:** el backend actual descuenta disponible al crear el bulto, pero no expone un saldo separado llamado `Reservado`. La UI sólo debe mostrar “reservado para despacho” si ese read model se implementa; hasta entonces mostrará el movimiento y el disponible resultante.

### Paso 3. Precintar y aprobar cada bulto

**Actor:** Administrador u Operador.

**Entrada:** bulto `Preparado` con contenido completo y válido.

**Pantalla:** ficha del bulto dentro del empaquetado.

**Acciones, en este orden:**

1. asignar un código de precinto, individualmente o mediante lote revisado con un código único por bulto;
2. aprobar el bulto `Precintado`, individualmente o con `Aprobar bultos listos`.

**Validaciones:** código existente, intacto, disponible y nunca utilizado; bulto no vacío.

**Resultado:** bulto `Precintado`, precinto consumido y evidencia individual de aprobación registrada. La aprobación no agrega un estado al ciclo del bulto.

**Confirmación UI:** `BLT-203 quedó precintado con PR-884. Ya no puede modificarse su contenido.`

### Paso 4. Emitir el único remito

**Actor:** Administrador u Operador.

**Entrada:** orden `En preparación`.

**Pantalla:** detalle de orden, bloque `Remito`.

**Condiciones obligatorias:**

- todo lo pedido está empaquetado;
- todos los bultos están `Precintado`;
- todos los bultos tienen evidencia individual de aprobación;
- no existe otro remito para la orden;
- origen y destino coinciden con la orden.

**Resultado:** remito `Emitido` con todos los bultos de la orden.

Si falta algo, el botón permanece deshabilitado y enumera exactamente qué cantidades o precintos faltan.

### Paso 5. Despachar el remito completo

**Actor:** Administrador u Operador.

**Entrada:** remito `Emitido`.

**Pantalla:** revisión de despacho.

**La revisión confirma:** número de remito, orden, origen, destino, bultos, precintos, unidades y responsable.

**Resultado atómico:**

- remito `Despachado`;
- todos los bultos `En tránsito`;
- orden `Despachada`;
- unidades sumadas al saldo `En tránsito` del local destino;
- eventos de trazabilidad guardados.

**Mensaje UI:** `Se despacharon 3 bultos y 47 unidades hacia Local Centro. Aún no son stock vendible.`

### Paso 6. Registrar el arribo

**Actor:** Administrador u Operador en destino.

**Entrada:** remito `Despachado`.

**Pantalla:** tarea móvil o `Recepción > Pendientes`.

**Acción:** registrar recepción física del remito completo.

**Resultado:** remito `Recibido` y todos sus bultos `Recibido`.

Este paso sólo registra llegada. No acredita stock y no verifica automáticamente los precintos.

### Paso 7. Verificar cada precinto

**Actor:** Administrador u Operador en destino.

**Entrada:** bulto `Recibido`.

**Pantalla:** control individual del bulto.

La UI enfrenta dos valores:

- `Precinto esperado`: el registrado al preparar el bulto;
- `Precinto observado`: el leído físicamente en destino.

También exige decidir si la faja está intacta.

**Resultado conforme:** código igual e intacto -> bulto `Verificado`.

**Resultado no conforme:** código distinto, precinto roto o ausencia de precinto -> bulto `Rechazado`, con motivo visible.

La verificación todavía no mueve stock disponible. El efecto se aplica al cerrar el remito.

### Paso 8. Cerrar el remito y la orden

**Actor:** Administrador u Operador.

**Entrada:** remito `Recibido` y todos los bultos `Verificado` o `Rechazado`.

**Pantalla:** resumen final de recepción.

**Antes de confirmar muestra:**

- bultos verificados y rechazados;
- unidades que se acreditarán;
- unidades que pasarán a merma;
- productos afectados;
- local destino.

**Resultado atómico:**

- remito `Cerrado`;
- orden `Cerrada`;
- bultos verificados: disminuye tránsito y aumenta disponible;
- bultos rechazados: disminuye tránsito y aumenta merma;
- resumen final persistente y consultable.

## 5. Cómo consultar el estado en vivo

“En vivo” se implementa sin complejidad innecesaria:

- después de una acción propia, la pantalla vuelve a consultar inmediatamente;
- listas y detalles operativos visibles se actualizan cada 15 segundos;
- al volver a una pestaña, se actualizan antes de mostrar acciones;
- cada pantalla enseña `Actualizado hace N s` y ofrece `Actualizar`;
- si falla la red, conserva el último dato, lo marca como desactualizado y bloquea acciones que requieran certeza.

No se necesita WebSocket para esta primera versión. Si más adelante el volumen o la concurrencia hacen insuficiente el intervalo, se migra el mismo contrato visual a eventos push.

### 5.1 Búsqueda global

El buscador del header acepta:

- orden: `OR-00482`;
- remito: `RMT-2026-0084`;
- bulto: `BLT-203` o ID;
- precinto: `PR-884`;
- SKU: `ALM-001`.

Cada resultado muestra tipo, estado actual, origen/destino, última actualización y relación principal. Abrirlo lleva a la ficha exacta, no a una lista genérica.

### 5.2 Panel de control

El Administrador ve en una sola pantalla:

- alertas que requieren acción;
- órdenes listas para preparar o bloqueadas;
- remitos listos para despachar;
- envíos en tránsito;
- recepciones pendientes de control;
- últimos movimientos.

Cada contador abre su lista con el filtro aplicado.

### 5.3 Listas operativas

Las listas permiten filtrar por estado, origen, destino, fecha, producto y responsable. Columnas mínimas:

| Entidad | Columnas esenciales |
|---|---|
| Orden | ID, origen, destino, productos/unidades, estado, progreso, próxima acción. |
| Remito | Número, orden, origen, destino, bultos resueltos/total, estado documental, progreso. |
| Bulto | ID, orden, remito, precinto, estado, última transición, ubicación lógica. |

### 5.4 Ficha de orden

Muestra estado actual, origen/destino, líneas pedidas-empaquetadas-pendientes, bultos, remito único, progreso general, historial derivado y próxima acción.

### 5.5 Ficha de remito

Muestra estado documental separado del progreso de bultos, orden relacionada, origen/destino, todos los bultos, precintos, recepción, resultados de control e impacto final.

### 5.6 Ficha de bulto

Es la unidad de trazabilidad más detallada:

```text
Bulto BLT-203      En tránsito      Precinto PR-884
Orden OR-00482 -> Remito RMT-2026-0084 -> Local Centro

Preparado      19 oct 09:54   CD Norte     M. Gómez
Precintado     19 oct 10:18   PR-884       M. Gómez
En tránsito    19 oct 10:42   RMT-0084     M. Gómez
Recibido       Pendiente
Verificado     Pendiente

Contenido: 3 productos, 15 unidades
Stock: salió de disponible CD -> en tránsito -> pendiente de control
```

Cada evento muestra transición, fecha/hora, actor, ubicación, documento y observación. Ningún evento se edita o elimina desde la UI.

## 6. Qué ve el Operador

El Operador no navega módulos. Ve una cola móvil de tareas:

1. `Revisar y precintar BLT-203`.
2. `Despachar RMT-0084`.
3. `Registrar llegada de RMT-0079`.
4. `Verificar precinto de BLT-188`.
5. `Cerrar RMT-0079`.

Cada tarea abre directamente en la siguiente acción válida y explica:

- qué está registrando;
- qué estados cambiarán;
- qué impacto tendrá en stock;
- qué condición falta si está bloqueada.

El Administrador puede abrir y ejecutar las mismas tareas desde las fichas completas.

## 7. Excepciones y recuperación

| Caso | Respuesta UI |
|---|---|
| Stock insuficiente al empaquetar | Indica SKU, solicitado, disponible y faltante; conserva el borrador. |
| Precinto inexistente o usado | Marca el campo, explica el motivo y mantiene el bulto `Preparado`. |
| Orden incompleta | Bloquea remito y lista cantidades sin empaquetar. |
| Bulto sin precinto | Bloquea remito y enlaza el bulto pendiente. |
| Segundo remito para la misma orden | Bloquea y abre el remito existente. |
| Recepción repetida | Informa el estado actual; no repite la transición. |
| Código distinto o precinto roto | Exige confirmación del rechazo y registra el motivo. |
| Cierre con bultos pendientes | Indica cuáles faltan y ofrece continuar el control. |
| Datos desactualizados | Refresca antes de confirmar; si cambió el estado, explica el nuevo siguiente paso. |
| Error de red | Conserva los datos ingresados, no muestra éxito y permite reintentar. |

## 8. Evento mínimo de trazabilidad

Para que la UI cumpla la consulta detallada, cada evento debe exponer:

- identificador del evento;
- tipo e ID de entidad;
- estado anterior y nuevo;
- fecha y hora;
- usuario/operador;
- ubicación;
- orden, remito, bulto y precinto relacionados cuando correspondan;
- observación o motivo;
- movimiento de stock asociado, si existe.

## 9. Brechas actuales que el plan debe resolver

| Brecha comprobada | Impacto UI | Contrato requerido |
|---|---|---|
| La trazabilidad existente sólo se consulta por `bulto_id`. | No permite búsqueda unificada ni historial completo de orden/remito. | Read model de trazabilidad buscable y relaciones navegables. |
| El historial de bulto no expone operador ni ubicación como campos propios. | La línea de tiempo no puede atribuir completamente cada evento. | Agregar actor, ubicación y documento correlacionado al evento. |
| La emisión actual acepta cualquier conjunto no vacío de bultos precintados. | Podría emitirse un remito parcial pese a la regla aprobada. | Validar orden completa y unicidad del remito en backend; la UI también bloquea. |
| El stock reservado no existe como saldo explícito. | No puede mostrarse una cifra de “reservado” confiable. | Exponer saldo reservado o limitar la UI a disponible resultante y movimiento. |
| No existe canal push. | El estado no cambia instantáneamente en otras sesiones. | Actualización visible cada 15 s; evaluar push sólo si fuera necesario. |

## 10. Aprobación individual y aprobación conjunta

### 10.1 Bultos listos para remito

- **Individual:** desde la fila o ficha del bulto `Precintado`, “Aprobar bulto” verifica cantidades completas y precinto único asignado. Registra actor, fecha, versión del contenido y resultado del control.
- **Conjunta:** desde la orden, “Aprobar bultos listos” muestra todos los bultos, selecciona sólo los elegibles y explica cada bloqueo. Confirmar crea evidencia individual para cada seleccionado; no crea un estado nuevo ni corrige datos automáticamente.

### 10.2 Precintos en recepción

- **Individual:** desde la ficha del bulto, el operador compara el código esperado con el leído y decide Íntegro o Violado. Violado exige motivo.
- **Conjunta:** desde el remito recibido, “Controlar todos los precintos” exige lectura y resultado por cada bulto. La confirmación registra los resultados individuales en una sola operación de UI; si una fila es inválida, no se informa cierre exitoso.

El botón conjunto reduce clics, no evidencia. Nunca equivale a “marcar todo correcto”. El cierre sigue bloqueado mientras exista un bulto sin resultado.

## 11. Criterios de aceptación del flujo

1. Desde el panel, un Administrador abre cualquier alerta o pendiente ya filtrado con una acción.
2. Desde la búsqueda global, llega al historial de una orden, remito o bulto en dos acciones o menos.
3. La UI nunca ofrece una transición inválida para el estado actual.
4. Un remito no puede emitirse si falta una unidad o un precinto de la orden.
5. Después del despacho, las unidades aparecen en tránsito pero no disponibles en destino.
6. Después de recibir, cada bulto permanece pendiente hasta verificar o rechazar su precinto.
7. El cierre no se habilita mientras exista un bulto sin resolver.
8. El resumen de cierre coincide con unidades acreditadas y unidades en merma.
9. Cada evento de bulto permanece visible y ordenado cronológicamente.
10. Una falla de red o un dato desactualizado nunca produce una confirmación falsa.
