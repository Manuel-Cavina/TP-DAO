# Rediseño UX operativo de Stocky ERP

> Estado: antecedente de diseño. Para implementación prevalecen `specs/001-stocky-operational-ux/`, `arquitectura_ui_operativa_detallada.md` y `flujo_core_logistico_ui.md`.

> Referencia de diseño desktop. Este documento convierte los requisitos de negocio en reglas de interfaz, componentes, flujos, validaciones y tareas verificables.

## Objetivo

Stocky guía trabajo operativo de punta a punta. No presenta CRUDs desconectados ni permite movimientos de stock sin documento, validación y trazabilidad.

**Regla central:** ningún movimiento es stock disponible hasta confirmar su documento origen, cantidades y controles requeridos. Cada evento registra producto, documento, sede, operador y fecha.

## Arquitectura de información

| Grupo | Subítems | Propósito |
|---|---|---|
| Inicio | Operación de hoy | Inbox, alertas y últimos movimientos |
| Maestros | Productos, Proveedores, Red logística | Configuración operativa |
| Inventario | Stock, Ingresos, Movimientos | Saldos y recepción documental |
| Reposición y despacho | Necesidades, Órdenes, Empaquetado, Remitos | CD a locales |
| Recepción y control | Recepción, Verificación | Validar y cerrar tránsito |
| Ventas y caja | POS, Comprobantes, Devoluciones | Venta y devolución controlada |
| Control | Trazabilidad, Auditoría | Investigación y decisión |

El sidebar usa grupos contraíbles: solo se abre el grupo activo, no supera dos niveles y solo muestra contadores de trabajo pendiente. El header conserva selector de sede, contexto CD/Local, acceso a inbox, tema y operador. Las operaciones con origen/destino muestran ambos explícitamente.

## Estados y pasos obligatorios

```text
Necesidad → Orden borrador → Orden confirmada → En preparación
→ Bulto preparado → Precintado → Remito emitido → Despachado
→ Recibido → Verificado/Rechazado → Remito y orden cerrados
```

| Estado | Acción habilitada | Bloqueo que debe explicar la UI |
|---|---|---|
| Necesidad | Crear orden | No se mezclan locales en una orden |
| Borrador | Confirmar orden | Faltan origen, destino o renglones |
| Orden confirmada | Crear bulto | Stock CD insuficiente |
| Bulto preparado | Precintar | Precinto vacío, duplicado o reutilizado |
| Remito emitido | Despachar | Hay bultos sin precinto |
| Remito despachado | Registrar arribo | Documento ya recibido/cerrado |
| Bulto recibido | Verificar | Falta código físico o decisión |
| Controles completos | Cerrar remito | Quedan N bultos pendientes |

Nunca se renderiza una acción que el backend rechazará. El botón disabled lleva un texto cercano con la condición faltante y la acción válida siguiente.

## Modelo de stock

| Saldo | Qué representa | ¿Vendible/despachable? |
|---|---|---|
| Disponible | Confirmado y apto en esa sede | Sí |
| Reservado | Comprometido para orden/bulto | No |
| En tránsito | Despachado a destino | No |
| Pendiente de confirmar | Recibido pero sin validación/cierre | No |
| Merma | Rechazado/no apto | No |

Todo ingreso debe originarse en: orden de abastecimiento de proveedor a CD, orden de reposición con remito, devolución confirmada o ajuste excepcional auditado. La confirmación mueve pendiente a disponible. La recepción de un remito no acredita disponible: lo hace el cierre tras verificar bultos.

## Pantallas desktop

### Inicio operativo

1. **Inbox prioritaria:** alertas Observer, ingresos pendientes, remitos bloqueados y tareas de caja. Cada fila muestra prioridad, producto/documento, sede, antigüedad y un único botón de resolución.
2. **Últimos movimientos:** ingreso, despacho, cierre, venta, devolución y merma; documento, operador, fecha e impacto.
3. **Indicadores de decisión:** cada indicador abre la lista filtrada que explica el dato. No hay cards decorativas.

### Producto como única fuente de verdad

Una ficha con tabs: `General`, `Precio y mínimo`, `Stock por sede`, `Movimientos`, `Historial`. Precio, costo, margen y mínimo no tienen página propia. Los cambios guardan usuario, fecha y valor anterior/nuevo.

### Ingreso de mercadería

Ruta `/inventario/ingresos/nuevo`, wizard de página completa:

1. Documento origen: proveedor/orden, CD, comprobante y fecha.
2. Artículos: buscador SKU/nombre, esperado vs. recibido, diferencias y cantidades.
3. Revisión: impacto antes/después y confirmación.

La pantalla principal tiene tabs `Stock en CD`, `Últimos movimientos`, `Pendientes de confirmar`. Tras confirmar abre el detalle histórico, no una tarjeta de sesión.

### Reposición, empaquetado y recepción

- Necesidades: filtros por local, urgencia, SKU/nombre, categoría y proveedor; selección consolidada y resumen fijo.
- Orden: wizard con origen, destino, renglones y disponibilidad real de CD.
- Empaquetado: dos columnas, renglones restantes a la izquierda y bultos/precintos a la derecha.
- Recepción: checklist por bulto con precinto esperado, observado, decisión y observación.
- Trazabilidad: búsqueda por bulto, precinto, remito, orden, SKU, sede o fechas; línea de tiempo inmutable.

### Ventas y caja

POS de dos columnas: búsqueda/catálogo y carrito/cobro. Antes de cobrar valida stock total de todas las líneas. Las devoluciones parten de un comprobante y muestran comprado, devuelto y máximo permitido.

## Sistema visual

| Token | Valor | Uso |
|---|---:|---|
| Fondo | `#FBFBFA` | Lienzo |
| Superficie | `#FFFFFF` | Tablas, formularios, paneles |
| Primary grafito | `#262623` | Confirmar, avanzar, despachar, cobrar |
| Grafito fuerte | `#141413` | Hover y texto principal |
| Sidebar | `#152238` | Navegación |
| Éxito | `#15803D` | Confirmado, disponible, cierre correcto |
| Advertencia | `#B45309` | Pendiente, tránsito, atención |
| Peligro | `#B91C1C` | Merma, rechazo, acción destructiva |
| Información | `#0284C7` | Información no bloqueante |
| Ámbito CD | `#6D28D9` | Compra y despacho |
| Ámbito Local | `#0F766E` | Venta, devolución y recepción |

El grafito es el único color primary. Los demás colores solo comunican estado. Tipografía sans de sistema: 22 px título, 18 px sección, 14 px cuerpo, 13 px tablas y 12 px ayuda; pesos 400/500. Cantidades, dinero, porcentajes, fechas y códigos usan números tabulares.

## Componentes estandarizados

| Componente | Regla de uso |
|---|---|
| Primary | Única acción principal del contexto |
| Secondary | Editar, revisar, volver |
| Ghost | Ver detalle, limpiar, acción terciaria |
| Danger | Rechazar/anular/baja; confirma intención |
| Status badge | Estado de dominio, sentence case y color semántico |
| Tabla | Búsqueda, filtros, selección, loading, vacío, error y reintento |
| Stepper | Mismo componente para todos los wizards y estados; no permite saltos |
| Drawer | Detalle rápido o edición simple |
| Página wizard | Cambio de stock/estado, validación o impacto |
| Inbox | Tarea pendiente con una acción de resolución |

## Validación de formularios

La validación ocurre en cliente, dominio y revisión final. Un wizard no avanza hasta que su paso sea válido; el primer error recibe foco y los valores se conservan.

| Flujo | Campos obligatorios | Reglas |
|---|---|---|
| Sede | tipo, nombre, dirección | CD/Local válido; nombre no vacío |
| Producto | SKU, nombre, categoría, proveedor, costo, precio, mínimo | SKU único; monetarios > 0; mínimo entero >= 0 |
| Proveedor | razón social, CUIT | CUIT único de 11 dígitos |
| Ingreso | documento, CD, proveedor, renglones, cantidades | entero > 0; origen permitido |
| Orden | local, CD, renglones | origen != destino; un único local |
| Bulto | orden, producto, cantidad | cantidad > 0 y <= restante |
| Precinto | código | único/no reutilizable |
| Recepción | remito, bulto, código físico, decisión | código observado obligatorio |
| Venta | local, líneas, pago | stock total suficiente |
| Devolución | comprobante, línea, cantidad, motivo | <= saldo devolvible y <= 30 días |

Mensajes estándar: “Completá este campo para continuar.”, “Ingresá una cantidad entera mayor a cero.”, “El CD dispone de 12 u.; esta operación requiere 20 u.” y “No se pudo conectar. Revisá la red y reintentá; tus datos siguen en el formulario.” No se exponen excepciones internas.

## Notificaciones y carga

| Patrón | Uso | Acción requerida |
|---|---|---|
| Toast éxito | Mutación completada | `Ver movimiento` cuando corresponde |
| Toast error | Falla recuperable/no inline | `Reintentar` cuando es seguro |
| Error inline | Campo/paso inválido | Foco al campo |
| Banner | Regla o bloqueo contextual | Acción para resolverlo |
| Inbox | Riesgo o trabajo pendiente | Una acción operativa |

Todas las notificaciones persistentes llevan un botón al lado. Tablas cargan skeleton estructural, no spinner aislado; vacíos enseñan qué crear; errores tienen reintento.

Motion: pantalla 200 ms con opacidad/desplazamiento corto, paso 180–220 ms según dirección, modal/drawer 200 ms con foco atrapado, botón loading contra doble envío. Se elimina easing elástico y se respeta `prefers-reduced-motion`.

## Indicadores de decisión

| Indicador | Comparación | Acción |
|---|---|---|
| Riesgo de quiebre | Bajo mínimo vs. semana anterior | Priorizar reposición |
| Cobertura estimada | Disponible / consumo diario promedio | Anticipar compra/reposición |
| Tránsito vencido | Despachado sin recepción sobre SLA | Contactar destino |
| Pendiente confirmar | Unidades recibidas no acreditadas | Completar control |
| Valor comprometido | Reservado + tránsito × costo | Gestionar capital inmovilizado |
| Merma | Unidades/valor por período | Revisar proveedor/transporte |
| Venta neta | Ventas - devoluciones vs. período previo | Gestionar caja/local |

Todo porcentaje declara período, base y alcance. Cada indicador enlaza a una lista filtrada.

## Contrato API y seed

La UI habilita una acción solo si endpoint y estado la permiten; cada mutación refresca lista, detalle e historial relevante. El seed debe incluir: maestros, alertas, orden confirmada, orden en empaquetado, remito despachado, remito recibido pendiente, remito cerrado con merma, ingreso pendiente/confirmado, venta, comprobante y devolución. No contiene estados heredados incompatibles.

## Fases y tareas

### Fase 0: dominio y seed

- [ ] Matriz de transición permitida por endpoint.
- [ ] Normalización de legado y seed funcional.
- [ ] Tests de transición inválida, recepción y cierre.
- [ ] Mensajes de error de dominio legibles.

**Aceptación:** el seed no genera una acción imposible.

### Fase 1: shell y componentes

- [ ] Tokens de color, foco, espaciado y tipografía.
- [ ] Botones, badges, tablas, filtros, banners, toasts y empty states.
- [ ] Selector global de sede e inbox accionable.
- [ ] Estados loading/error/vacío y motion estándar.

**Aceptación:** toda pantalla comparte semántica visual e interacción.

### Fase 2: maestros e inventario

- [ ] Ficha única de producto.
- [ ] Matriz de stock con saldos separados.
- [ ] Wizard de ingreso e historial persistente.
- [ ] Trazabilidad por producto/sede/documento.

**Aceptación:** no hay incremento de disponible sin documento y confirmación.

### Fase 3: reposición a cierre

- [ ] Necesidades filtrables y orden guiada.
- [ ] Empaquetado con bultos, restantes y precintos.
- [ ] Recepción/checklist/cierre.
- [ ] Pantalla central de trazabilidad.

**Aceptación:** happy path CD → Local sin pasos saltables.

### Fase 4: ventas y caja

- [ ] POS y estrategias de cobro.
- [ ] Comprobante/caja posterior a venta.
- [ ] Devoluciones vinculadas y movimientos consolidados.

**Aceptación:** venta y devolución dejan stock, caja e historial coherentes.

### Fase 5: inicio y calidad

- [ ] Inicio operativo, inbox e indicadores explicables.
- [ ] Capturas Playwright desktop de flujos críticos.
- [ ] Revisión de teclado, foco, contraste y mensajes.

**Aceptación:** el administrador identifica y resuelve su siguiente tarea en menos de un minuto.

## Criterios globales

- P1–P7 completos desde UI con datos del seed.
- Ningún control salta estados.
- Toda operación muestra origen e impacto.
- Todo error tiene recuperación legible.
- Toda alerta persistente tiene acción.
- Tablas cubren loading, vacío, error y reintento.
