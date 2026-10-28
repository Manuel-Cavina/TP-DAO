# Stocky ERP: arquitectura UI operativa detallada

Estado: aprobado para implementación el 20 de octubre de 2026. `specs/001-stocky-operational-ux/` define el backlog ejecutable.

## 1. Decisión de producto

Stocky se diseña como una aplicación web responsiva con dos experiencias sobre el mismo dominio:

- **Administrador**: escritorio primero, superusuario funcional, con control completo, maestros, inventario, logística, reportes y todas las acciones del Operador.
- **Repartidor/Operador general**: móvil primero, con trabajo asignado, siguiente acción explícita y sólo el contexto necesario para preparar, despachar, recibir y verificar.

El acceso comienza en una pantalla de login. Como mínimo existen una cuenta Administrador y una cuenta Operador; la sesión resuelve rol, centros/locales permitidos y acciones. Ocultar controles en frontend no sustituye la autorización del backend.

El objetivo no es mostrar más datos, sino permitir responder sin ambigüedad: **qué requiere atención, dónde está cada envío, qué puedo hacer ahora, qué consecuencia tendrá y quién hizo cada cambio**.

## 2. Mapa de pantallas y navegación

### 2.1 Shell del Administrador

Sidebar fija en escritorio y panel deslizable en móvil:

1. Inicio
2. Operaciones
   - Necesidades
   - Órdenes
   - Preparación y despacho
   - Recepciones
   - Trazabilidad
3. Inventario
   - Existencias
   - Alertas
   - Ingresos
4. Catálogo
   - Productos y precios
   - Categorías
   - Proveedores
5. Sedes
6. Ventas y caja (UI integrada al backend oficial proveniente de `main`)
7. Reportes

Header: búsqueda global, selector explícito de alcance (red, CD o local), frescura de datos, centro de notificaciones, ayuda contextual y avatar/menú de usuario. No lleva métricas ni accesos duplicados.

### 2.2 Shell del Operador

Navegación inferior móvil: **Trabajo**, **Escanear/buscar**, **Historial** y **Perfil**. La portada muestra siempre el CD al que reporta el operador, local de trabajo seleccionado, turno, supervisor y sólo las sedes asignadas. Ordena tareas por urgencia y muestra una sola acción dominante por tarjeta. En escritorio utiliza una barra lateral reducida con las mismas opciones.

### 2.3 Rutas conceptuales

| Pantalla | Ruta conceptual | Usuario | Propósito |
|---|---|---|---|
| Panel de control | `/inicio` | Administrador | Alertas, pendientes, últimos movimientos y acceso filtrado |
| Necesidades | `/operaciones/necesidades` | Administrador | Consolidar demanda compatible |
| Órdenes | `/operaciones/ordenes` | Ambos | Buscar, filtrar y seguir órdenes |
| Detalle de orden | `/operaciones/ordenes/:id` | Ambos | Ver avance documental y físico completo |
| Preparación Kanban | `/operaciones/preparacion` | Ambos | Gestionar trabajo activo por etapa |
| Detalle de remito | `/operaciones/remitos/:id` | Ambos | Emitir, despachar, recibir y cerrar el único remito |
| Detalle de bulto | `/operaciones/bultos/:id` | Ambos | Contenido, precinto, estado e historial del bulto |
| Explorador de trazabilidad | `/operaciones/trazabilidad` | Administrador | Consulta transversal por cualquier identificador |
| Recepciones | `/operaciones/recepciones` | Ambos | Control de arribo y precintos |
| Reportes | `/reportes` | Administrador | R1/R2 interactivos y exportación formal |

## 3. Patrón único para cada detalle trazable

Orden, remito y bulto comparten el mismo esqueleto para que el usuario no reaprenda la interfaz:

```text
┌ Breadcrumb con retorno y filtros preservados                         ┐
│ TIPO + IDENTIFICADOR   [Estado actual]      Actualizado hace 8 s     │
│ Origen → Destino · Responsable · Fecha       [Acción primaria válida] │
├ Resumen ─ Contenido ─ Trazabilidad ─ Documentos/impacto ─────────────┤
│ Contexto principal (2/3)                  Próxima acción (1/3)       │
│ datos, avance, relacionados               requisitos y consecuencia  │
├───────────────────────────────────────────────────────────────────────┤
│ Actividad reciente / línea temporal; autor, sede, fecha y motivo      │
└───────────────────────────────────────────────────────────────────────┘
```

Reglas comunes:

- El estado siempre aparece junto al identificador, nunca sólo por color.
- La acción primaria expresa verbo y resultado: “Emitir remito completo”, “Registrar despacho”, “Confirmar recepción”.
- Si los datos tienen más de 15 segundos o no pudieron revalidarse, la acción queda deshabilitada con explicación y botón “Actualizar datos”.
- Cada relación es navegable en ambos sentidos y conserva filtros/búsqueda al volver.
- La trazabilidad es un registro de eventos, no una colección de toasts. El toast sólo confirma la acción inmediata.

### 3.0 Contrato de las demás entidades

| Entidad | Identidad visible | Datos principales | Estado/acción | Trazabilidad relacionada |
|---|---|---|---|---|
| Sede | nombre + tipo + código | dirección, contacto, activo | activar/desactivar; no borrar si tiene historia | ingresos, salidas, stock y órdenes |
| Producto | SKU + nombre | categoría, proveedor, costo, precio, mínimo y activo | editar o actualizar atributo masivo | existencias, órdenes, bultos, ventas futuras |
| Categoría | nombre | descripción y productos asociados | editar/desactivar | cambios de catálogo |
| Proveedor | razón social + código | contacto, productos y activo | editar/desactivar | cambios de catálogo |
| Necesidad | ID + local + producto | solicitado, prioridad, origen candidato y antigüedad | incluir en orden compatible | orden resultante y actor |
| Movimiento de stock | ID + tipo | producto, cantidad, sede, origen documental | sólo lectura | orden/remito/bulto/venta relacionada |
| Usuario | nombre + avatar | rol, sede y estado real de acceso | asignar responsable donde aplique | acciones registradas, nunca editables |
| Alerta | tipo + entidad | causa, antigüedad y severidad textual | resolver desde el registro de origen | evento que la originó y resolución |

Los maestros se editan en drawer; las entidades operativas se consultan en página completa; movimientos y eventos son inmutables.

### 3.1 Detalle de orden

**Encabezado:** Orden `OR-000123`, estado, origen, destino, fecha, responsable y progreso “18/24 unidades empaquetadas”.

**Resumen:** barra de avance por cantidades; necesidades consolidadas; faltantes; un único remito asociado o estado “todavía no emitido”.

**Contenido:** tabla Producto/SKU, solicitado, empaquetado, pendiente y bultos que lo contienen. Un producto puede enlazar todos sus bultos.

**Trazabilidad:** creación, inicio de preparación, creación de cada bulto, precintado, emisión de remito, despacho y cierre. Cada evento identifica actor, sede, documentos y efecto de stock.

**Panel de próxima acción:** sólo la transición válida. Si faltan cantidades o precintos, lista exactamente los bloqueos y enlaza el registro que debe corregirse.

### 3.2 Detalle de remito

**Encabezado:** número de remito, estado documental, Orden vinculada, origen → destino, emisión y responsable.

**Resumen:** conteo de bultos y unidades; indicador “completo respecto de la orden”; avance de recepción y control.

**Bultos:** tabla/tarjetas con ID, precinto, unidades, estado físico y resultado de control. No permite quitar bultos después de emitir.

**Trazabilidad:** emisión, despacho, arribo, verificación de cada bulto y cierre. Muestra además el estado de la orden sin confundirlo con el estado del remito.

**Documentos:** vista previa y descarga del remito. La impresión contiene todos los bultos, productos, cantidades, origen, destino y precintos.

### 3.3 Detalle de bulto

**Encabezado:** Bulto `BU-000045`, estado físico, precinto o “sin asignar”, remito y orden.

**Contenido:** productos y cantidades; total de unidades; quién lo armó; fechas; origen y destino heredados de la orden.

**Control de precinto:** código esperado, resultado intacto/violado, operador, fecha y motivo. Un código se presenta también como texto; QR/código de barras es una ayuda, no el único acceso.

**Impacto:** reservado al crear, en tránsito al despachar, preparado para acreditación al verificar intacto o para merma al rechazar, y aplicado al cerrar el remito. Siempre indica cantidad y ubicación afectada.

**Trazabilidad:** línea temporal completa del bulto y enlaces al evento equivalente del remito/orden.

### 3.4 Explorador de trazabilidad

Una búsqueda acepta orden, remito, bulto, precinto, SKU o producto. Los resultados se separan por tipo y muestran identificador, relación principal, estado, ubicación y última actualización. Al abrir un resultado:

- columna izquierda: filtros por entidad, estado, sede, fecha y responsable;
- centro: eventos cronológicos, paginados y no editables;
- derecha: grafo documental compacto `Orden → Remito → Bultos` y efecto acumulado de stock;
- exportación: sólo el resultado filtrado y sus metadatos, no la pantalla completa.

## 4. Máquinas de estado completas

La UI no inventa estados. Los nombres visibles pueden ser más claros, pero siempre se mapean uno a uno al valor de dominio.

### 4.1 Necesidad

```text
Pendiente ── consolidar ──> Incluida en orden
```

Bloqueos: producto/local inactivo, cantidad inválida o una selección con destinos diferentes. El valor persistido canónico después de consolidar es `CONSOLIDADA`.

### 4.2 Orden de reposición

```text
PENDIENTE ── crear primer bulto ──> EN_PREPARACION
EN_PREPARACION ── despachar remito completo ──> DESPACHADA
DESPACHADA ── cerrar recepción resuelta ──> CERRADA
```

No existe despacho parcial. “Lista para remito” y “Lista para despacho” son condiciones calculadas, no estados persistidos.

### 4.3 Bulto

```text
PREPARADO ── asignar precinto ──> PRECINTADO
PRECINTADO ── despachar remito ──> EN_TRANSITO
EN_TRANSITO ── registrar arribo ──> RECIBIDO
RECIBIDO ── precinto intacto ──> VERIFICADO
RECIBIDO ── precinto violado/rechazo ──> RECHAZADO
```

`VERIFICADO` y `RECHAZADO` son finales. La aprobación de preparación ocurre después de `PRECINTADO`, queda como evidencia sin crear otro estado y es obligatoria antes del remito. El stock disponible sólo se acredita al cierre; un rechazo produce merma y exige motivo.

### 4.4 Remito

```text
EMITIDO ── registrar despacho ──> DESPACHADO
DESPACHADO ── registrar recepción ──> RECIBIDO
RECIBIDO ── resolver todos los bultos ──> CERRADO
```

El vocabulario contractual queda resuelto así: el remito usa `DESPACHADO`; `EN_TRANSITO` pertenece al bulto. Un valor histórico `EN_TRANSITO` de remito se lee como `DESPACHADO` y no vuelve a escribirse.

### 4.5 Precinto

```text
Disponible ── asignar a bulto ──> Asignado
Asignado ── control de recepción ──> Íntegro | Violado
```

Un precinto no se reasigna. El resultado del control queda unido al bulto, actor, fecha, sede y observación.

### 4.6 Impacto de stock

```text
Disponible en origen
  └─ crear bulto → reservado/no disponible
       └─ despachar → en tránsito en destino
            ├─ verificar → disponible en destino
            └─ rechazar → merma; nunca disponible
```

## 5. Kanban operativo con cambio de estado seguro

El Kanban complementa listas y detalles; no reemplaza la vista tabular, la búsqueda ni la trazabilidad.

### 5.1 Tablero “Preparación y despacho”

Columnas calculadas:

1. Por preparar
2. Empaquetando
3. Falta precintar
4. Lista para emitir remito
5. Lista para despachar
6. En tránsito

La tarjeta representa una **orden**, no mezcla entidades. Al desplegar muestra sus bultos.

### 5.2 Tablero “Recepción y control”

Columnas:

1. En tránsito
2. Arribados por recibir
3. Pendientes de verificar
4. Con incidencia
5. Cerrados hoy

La tarjeta principal representa un **remito**; el progreso interno muestra bultos resueltos. La vista “por bulto” es un filtro explícito, no otra semántica dentro del mismo tablero.

### 5.3 Tarjeta estandarizada

```text
┌ OR-000123                         [En preparación] ┐
│ CD Central → Local Palermo                         │
│ 4 bultos · 24 unidades · 2 sin precinto            │
│ Progreso 18/24                                     │
│ Responsable: [MG] Martín Gómez · hace 8 min        │
│ Bloqueo: completar 6 u. y precintar 2              │
└ [Ver detalle]                         [Siguiente ▾] ┘
```

Campos obligatorios: ID, origen/destino, estado textual, progreso, responsable/avatar, antigüedad, bloqueo y siguiente acción. La prioridad se expresa con etiqueta y orden, no con un borde de color sin texto.

### 5.4 Contrato inequívoco de drag-and-drop

1. Al tomar la tarjeta, sólo se resaltan destinos válidos; los inválidos explican el motivo.
2. Soltar **no persiste** ningún cambio.
3. El sistema abre el modal o drawer de la acción exacta, con entidad, estado actual, estado resultante, requisitos, consecuencia de stock y evidencia que quedará registrada.
4. Si faltan datos, el panel pide únicamente esos datos. Ejemplos: código de precinto, remito completo, confirmación de recepción o motivo de rechazo.
5. Sólo “Confirmar y registrar” llama al backend. Mientras procesa, no puede duplicarse la acción.
6. Éxito: se actualizan tarjeta, columnas y frescura; aparece un toast con identificador y resultado, y el foco vuelve a la tarjeta movida.
7. Conflicto o fallo: la tarjeta regresa visualmente a su columna, conserva los datos introducidos cuando sea seguro y muestra la causa y la recuperación.
8. Si otro usuario cambió la entidad, se presenta el nuevo estado y no se fuerza la transición anterior.
9. Teclado: menú “Cambiar estado” ofrece las mismas transiciones y paneles. En móvil se usan botones/menú; arrastrar no es requisito.

### 5.5 Mapeo de transición a panel

| Intención | Resultado posible | Panel obligatorio | Confirmación final |
|---|---|---|---|
| Orden → Empaquetando | Crear primer bulto | Drawer “Crear bulto” con productos/cantidades | Crear bulto e iniciar preparación |
| Bulto → Precintado | Asignar precinto | Modal corto con escaneo/ingreso y verificación de unicidad | Asignar precinto |
| Orden → Lista para remito | Validar completitud | Modal de revisión; si falta algo, sólo informa y enlaza | Emitir remito completo |
| Remito → En tránsito | Despachar todos los bultos | Modal de despacho con origen/destino, bultos y stock | Confirmar despacho |
| Remito → Recibido | Registrar arribo completo | Modal de recepción con remito y precintos esperados | Registrar recepción |
| Bulto → Verificado | Precinto intacto | Modal de control con código y consecuencia | Verificar; acreditar al cierre |
| Bulto → Rechazado | Precinto violado/incidencia | Modal de incidencia con motivo obligatorio | Rechazar y registrar merma |
| Remito → Cerrado | Todos los bultos resueltos | Resumen final acreditado/rechazado | Cerrar recepción |

No hay caída directa que omita un paso, transición individual que implique una operación colectiva ni confirmación genérica “Aceptar”.

### 5.6 Aprobación individual y por lote

**Bultos antes del remito:** cada fila permite “Aprobar bulto” después de validar contenido completo y precinto único asignado. “Aprobar bultos listos” procesa juntos sólo los `PRECINTADO` elegibles; no completa ni omite los bloqueados. La aprobación es una evidencia de preparación, no un estado nuevo del ciclo del bulto, y genera un resultado individual por bulto.

**Precintos en recepción:** el operador puede abrir un bulto y verificar su precinto individualmente o usar “Controlar todos los precintos” desde el remito. El modo por lote exige leer o ingresar cada código, comparar con el esperado y seleccionar Íntegro o Violado por fila. Si es Violado, exige motivo. “Confirmar todos los resultados” registra un evento por bulto; nunca marca todos como íntegros sin evidencia individual.

En ambos modos, un error en una fila no se oculta dentro de un éxito general. El resumen final separa aprobados, rechazados y pendientes, y el remito sólo puede avanzar cuando no quedan pendientes.

## 6. Sistema de componentes

Se reutilizan los componentes compartidos existentes y se corrigen sus contratos de accesibilidad antes de extenderlos.

### 6.1 Botones semánticos

| Variante | Uso | Apariencia | Ejemplos |
|---|---|---|---|
| Primary | única acción que avanza el flujo actual | fondo grafito con relieve sutil, texto blanco | Crear orden, Confirmar despacho |
| Secondary | acción importante no dominante | superficie, borde fuerte, texto principal | Guardar borrador, Ver remito |
| Ghost | navegación o acción auxiliar | transparente; fondo sólo en hover/focus | Volver, Abrir historial |
| Danger | consecuencia destructiva/merma | fondo o borde `danger`, texto explícito | Rechazar bulto, Desactivar producto |
| Link | navegación dentro de datos | texto subrayado en interacción | OR-000123, RM-000078 |

Máximo un Primary visible por contexto de tarea. Si una página tiene filtros, exportación y transición, sólo la acción correspondiente al objetivo actual es Primary; las demás son Secondary o Ghost. Los botones usan radio completo, altura compacta y relieve sutil tipo control nativo, sin convertirse en cápsulas sobredimensionadas. Icono más texto para acciones críticas. Estado cargando conserva ancho y etiqueta accesible. Deshabilitado siempre tiene explicación cercana; no se usa para ocultar permisos.

### 6.2 Select y listas desplegables

- Select nativo o componente con patrón ARIA completo: flechas cambian opción, Enter selecciona, Escape cierra y el foco activo es visible.
- Búsqueda integrada sólo con más de siete opciones.
- Cada opción puede tener título y descripción; estados inactivos se muestran sólo al consultar históricos.
- Para origen/destino: tipo de sede, nombre y dirección; jamás dos selects indistinguibles.
- Acciones contextuales usan menú, no un select que simule navegación.

### 6.3 Avatar y responsable

- 32 px en tablas/tarjetas, 40 px en header y 48 px en perfiles.
- Iniciales deterministas como fallback y nombre completo visible al lado en decisiones críticas.
- El punto de “conectado” sólo aparece si existe presencia real; no se infiere.
- “Sin asignar” usa icono de persona y texto, no iniciales falsas.

### 6.4 Badges y estados

Badge con etiqueta completa e icono opcional. Mapeo semántico: neutral para pendiente/preparado; info para emitido/recibido; warning para precintado/en tránsito/bajo mínimo; success para verificado/cerrado/óptimo; danger para rechazado/crítico. El mismo estado conserva color en toda la aplicación.

### 6.5 Drawer, modal y página completa

- **Drawer derecho (480–560 px):** alta/edición de maestros, creación de bulto y contexto complementario.
- **Modal pequeño (420–520 px):** confirmación o captura breve de una transición.
- **Modal grande (hasta 800 px):** revisión masiva o consecuencia compleja; cuerpo interno desplazable y acciones fijas.
- **Página completa:** wizard de orden, preparación de muchos bultos, recepción de un remito y reportes.

### 6.6 Toasts y errores

- Éxito: `“Bulto BU-000045 verificado. 12 unidades quedarán acreditadas al cerrar el remito.”`
- Advertencia: acción completada con consecuencia que requiere atención.
- Error: qué falló, qué no cambió y cómo recuperar. Errores de campo quedan junto al campo; el toast no los reemplaza.
- Los toasts no son la única evidencia y no desaparecen antes de que un lector pueda comprenderlos.

### 6.7 Creación, búsqueda y validación de campos

- Procesos de una decisión breve usan modal; altas/ediciones de maestros usan drawer; órdenes, recepción y otras operaciones complejas usan wizard en página completa.
- Hasta siete opciones se muestran junto al campo. Con más opciones, el campo se convierte en buscador/autocompletado paginado por nombre, código, SKU, CUIT o dirección según la entidad.
- El frontend recorta espacios, normaliza mayúsculas/códigos y formatos decimales, limita longitud y rechaza caracteres/tipos no admitidos antes de enviar.
- Campos numéricos usan `inputmode`, límites y precisión correspondientes, pero no confían sólo en el tipo HTML.
- El frontend nunca interpreta HTML ingresado por el usuario y muestra contenido como texto.
- La validación inmediata mejora la corrección, pero el backend vuelve a validar tipo, rango, unicidad, relaciones, estado actual, permisos y stock. La sanitización frontend no es una barrera de seguridad.
- Un error identifica el campo, la regla y cómo corregirlo; conserva valores válidos y enfoca el primer inválido al intentar continuar.

### 6.8 Actualización masiva de precios e indicadores

- La actualización masiva permite fijar un precio o incrementar/reducir los precios seleccionados por un porcentaje mayor que 0 y hasta 100, con máximo dos decimales.
- La revisión muestra por producto precio anterior, regla, porcentaje, diferencia monetaria y precio resultante. Se aplica de forma atómica y conserva los precios históricos de ventas.
- Indicadores vivos muestran valor, ventana comparada y dirección, por ejemplo `↑ 12% esta semana` o `↓ 8% vs. ayer`. La flecha nunca aparece sin período ni significado y el color no es la única señal.

## 7. Paleta, tipografía y datos

### 7.1 Paleta aprobable

| Token | Valor | Uso |
|---|---:|---|
| Canvas | `#F4F4F2` | fondo de aplicación |
| Surface | `#FFFFFF` | paneles, tablas y overlays |
| Surface muted | `#EDEDEB` | grupos y cabeceras secundarias |
| Navigation | `#111214` | sidebar grafito |
| Ink | `#151619` | texto principal |
| Ink muted | `#5F6065` | texto secundario |
| Border | `#D7D7D3` | separación estructural |
| Action | `#17181B` | primary y foco de marca |
| Action strong | `#2B2C30` | hover/active |
| Info | `#315F82` | estados informativos |
| Success | `#316B49` | resultado correcto |
| Warning | `#8A611D` | atención/transición |
| Danger | `#A23B35` | rechazo/error/merma |

No se ofrecen acentos intercambiables por pantalla: una sola identidad evita ruido. Colores de estado nunca sustituyen texto, icono o estructura.

### 7.2 Tipografía

Inter Variable servida localmente; fallback `system-ui, sans-serif`. Pesos 400, 500 y 600. Escala: 12/16 metadatos, 14/20 cuerpo, 16/24 subtítulo, 20/28 sección, 28/34 título. Tablas operativas usan 14 px; no se reduce texto para hacer caber columnas.

### 7.3 Números

- moneda: `ARS 1.234.567,89`;
- unidades: enteros con unidad visible;
- porcentajes: coma decimal y precisión máxima de dos;
- fecha/hora: `19 oct 2026, 14:35` y zona horaria del sistema;
- IDs: fuente monoespaciada opcional y copia accesible;
- columnas numéricas alineadas a la derecha con cifras tabulares.

## 8. Wireframes críticos

### 8.1 Panel de control del Administrador

```text
┌ Sidebar ┐ ┌ Buscar orden, remito, bulto, precinto…  [Sede] [🔔] [MG] ┐
│ Inicio  │ ├───────────────────────────────────────────────────────────┤
│ Operac. │ │ Buenos días. Operación al 19 oct · actualizado hace 6 s │
│ Invent. │ │ [7 tareas críticas] [12 en preparación] [5 en tránsito] │
│ Catál.  │ │ Alertas accionables        Trabajo pendiente             │
│ Sedes   │ │ • 2 remitos demorados      • 3 órdenes sin completar     │
│ Ventas  │ │ • 4 stock crítico          • 8 bultos por verificar      │
│ Report. │ │ Últimos movimientos (actor · entidad · consecuencia)     │
└─────────┘ └───────────────────────────────────────────────────────────┘
```

### 8.2 Kanban de preparación

```text
[Buscar] [CD] [Destino] [Responsable] [Lista | Kanban]  Actualizado 6 s
 Por preparar (4)   Empaquetando (6)   Falta precinto (3)   Para despacho (2)
 ┌ OR-123 ┐         ┌ OR-118 ┐         ┌ OR-115 ┐           ┌ OR-109 ┐
 │origen→ │         │18/24 u.│         │2 bultos│           │RM-077  │
 │destino │         │bloqueo │         │sin sello│          │4/4 listos│
 └────────┘         └────────┘         └────────┘           └────────┘
```

Al soltar `OR-115` en “Para despacho” se abre revisión; la tarjeta no cambia hasta que se emita el remito o se resuelvan los bloqueos.

### 8.3 Panel de transición disparado por Kanban

```text
┌ Emitir remito completo · OR-000115                         [×] ┐
│ Actual: En preparación → Resultado: Remito emitido             │
│ Origen: CD Central       Destino: Local Norte                  │
│ Validación                                                      │
│ ✓ 36/36 unidades empaquetadas   ✓ 3/3 bultos precintados       │
│ El remito incluirá todos los bultos y no podrá dividirse.      │
│ Evidencia: actor, fecha, origen, destino, orden, bultos.        │
│                              [Cancelar] [Emitir remito completo] │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4 Detalle de bulto móvil

```text
‹ Trabajo                                     Actualizado 5 s
BU-000045  [Recibido]
Precinto PC-883102 · Remito RM-000078
CD Central → Local Palermo

Siguiente acción
Verificar el precinto. Si está intacto, 12 unidades pasan a disponible;
si está violado, se registra merma.
[Precinto intacto]          [Registrar incidencia]

Contenido (3) · Trazabilidad (5) · Documentos
```

## 9. Historias de usuario, valor y pruebas

| Historia | Usuario y necesidad | Valor | Pantallas | Prueba de aceptación |
|---|---|---|---|---|
| US-01 Control operativo | Admin necesita ver el sistema completo sin recorrer módulos | reduce demora y omisiones | Inicio, listas filtradas | cada alerta abre su lista filtrada en un clic |
| US-02 Maestros consistentes | Admin necesita altas y cambios masivos revisables | evita edición repetitiva y errores | Listas, drawer, revisión masiva | ninguna fila cambia si una seleccionada es inválida |
| US-03 Orden completa | Admin consolida necesidades de un local desde un CD | crea demanda ejecutable y trazable | Necesidades, wizard, orden | no mezcla destinos y muestra origen/destino y faltantes |
| US-04 Preparar y remitir | Operador arma bultos, precinta y emite un remito completo | asegura integridad documental | Kanban, orden, bulto, remito | no emite mientras falte una unidad o precinto |
| US-05 Despachar | Operador registra la salida completa | inicia tránsito sin perder control | Remito, modal despacho | todos los bultos pasan juntos a tránsito y queda actor/hora |
| US-06 Recibir y verificar | Operador destino decide integridad de cada bulto | acredita stock correcto y aísla merma | Cola móvil, recepción, bulto | no cierra hasta resolver todos; consecuencia visible antes/después |
| US-07 Investigar | Admin necesita reconstruir cualquier movimiento | permite auditoría y atención de incidentes | Búsqueda, detalles, explorador | llega del ID al historial completo en máximo dos acciones |
| US-08 Informar | Admin necesita análisis interactivo y evidencia formal | permite decidir y compartir resultados confiables | R1, R2, exportación PDF | PDF reproduce filtros/snapshot y no recorta detalle |
| US-09 Venta/devolución UI | Admin necesita comprender flujo futuro sin falsa persistencia | valida UX sin inventar backend | Ventas/caja | si el backend no existe, conserva datos y no informa éxito |

### 9.1 Pruebas moderadas de usuario

Se realizan con cinco administradores y cinco operadores representativos, sin capacitación previa y con datos realistas.

1. Encontrar una orden a partir de un número de precinto y explicar su estado actual.
2. Crear una orden con tres productos desde necesidades del mismo destino.
3. Preparar dos bultos, precintarlos y explicar por qué todavía no se puede despachar.
4. Mover una tarjeta en Kanban, completar el panel exigido y localizar la evidencia creada.
5. Recibir un remito con un bulto intacto y uno violado; explicar el efecto de stock.
6. Exportar R1 filtrado y comprobar filtros, fecha, responsable y tabla.
7. Con red interrumpida, intentar una transición y explicar por qué quedó bloqueada.

Criterios: 90% completa cada tarea crítica sin ayuda; 100% comprende la consecuencia antes de confirmar; ningún participante interpreta que arrastrar por sí solo registró el cambio; todos encuentran el historial en dos acciones o menos.

## 10. Decisiones de diseño aprobadas

- Se aprueban estructura, navegación, roles, vocabulario de estados, patrón de detalle y semántica de acciones.
- Se aprueban explícitamente los dos Kanban, cada uno con un único tipo de entidad, y que el drop sólo dispara el panel correspondiente.
- Se aprueban paleta, tipografía, densidad, botones, formularios, drawers, modales, toasts y responsive.
- Se aprueban las dos fichas de reporte y sus documentos formales descritos en `reportes_pdf_profesionales.md`.
- La revisión visual se realiza en `prototipo_wireframes_stocky.html`; es un prototipo estático y no simula persistencia.
- La implementación transforma este contrato en componentes y pantallas productivas siguiendo `specs/001-stocky-operational-ux/tasks.md`.

## 11. Brechas técnicas que bloquean fidelidad total

1. El backend debe imponer un remito completo y único por orden; hoy la selección parcial de bultos es posible en el servicio inspeccionado.
2. Los eventos actuales de bulto no contienen siempre actor, sede, documentos relacionados ni movimiento de stock.
3. La trazabilidad debe poder consultarse por orden y remito, no sólo por `bulto_id`.
4. El backend debe dejar de escribir `EN_TRANSITO` para remitos, normalizarlo como legado a `DESPACHADO` al leer y reservar `EN_TRANSITO` para bultos.
5. El indicador “en vivo” será polling de 15 segundos en esta versión; WebSocket no es necesario para cumplir el objetivo.
