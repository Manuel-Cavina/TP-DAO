# TP Integrador 2026 - Tema 3: Sistema de Ventas e Inventario (Centro de Distribución a Locales)

Sistema orientado a objetos para gestionar compras, logística interna, ventas, inventario y resultado económico entre un **Centro de Distribución (CD)** y sus **locales**.

> **Idea central de la consigna:** _nada ingresa a stock vendible sin verificación._ Cada decisión de diseño de este documento protege esa regla.

**Documentos relacionados:** [convenciones.md](convenciones.md) (arquitectura, nombres, errores y persistencia) · [tema3.pdf](tema3.pdf) (consigna original).

---

## 🏗️ 1. Arquitectura y Tecnologías

- **Backend:** Python, Orientado a Objetos puro en el dominio.
- **Persistencia:** SQLite (`backend/src/config/database.py`).
- **Estructura:** Monolito modular. Cada módulo contiene sus propias capas `domain`, `application`, `infrastructure`, `dto`, `mappers` y `api`. **No existen capas de negocio globales.**
- **Nombres:** clases en `Pascal_Snake_Case`, todo lo demás en `snake_case` (ver [convenciones.md](convenciones.md), sección 3).
- **Patrones de diseño** (la consigna exige al menos dos; implementamos tres):

| Patrón | Módulo | Problema que resuelve |
|---|---|---|
| **State** | `logistica` | Ciclo de vida inmutable del bulto: cada estado sabe qué acciones admite. |
| **Strategy** | `ventas_caja` | Medios de cobro intercambiables sin `if`/`elif` por tipo de pago. |
| **Observer** | `ubicaciones_stock` | El stock avisa que llegó al mínimo sin conocer a quién le interesa. |

```text
backend/src/
├── config/                  # Conexión SQLite, schema.sql y seed
├── errors/                  # BusinessError (base de las excepciones de negocio)
└── modules/
    ├── catalogo/            # Integrante 1
    ├── ubicaciones_stock/   # Integrante 1
    ├── logistica/           # Integrante 2
    ├── ventas_caja/         # Integrante 3
    └── reportes/            # Integrante 4
frontend/src/
├── shared/                  # Componentes, cliente HTTP y estilos reutilizables
└── modules/                 # Una carpeta por módulo del backend
```

### Reportes

El módulo `reportes` usa **Plotly 7.1.0** para construir gráficos profesionales e
interactivos. El backend serializa las figuras como JSON y el frontend las renderiza, sin
acoplar las consultas de negocio a la biblioteca visual.

---

## 🗺️ 2. Mapa de la Consigna

Trazabilidad entre lo que pide la cátedra y quién lo resuelve. **Si algo de la consigna no aparece en esta tabla, no está cubierto.**

| Requisito de la consigna | Módulo | Integrante |
|---|---|---|
| P1. Administrar locales y CD | `ubicaciones_stock` | 1 |
| P2. Administrar productos, categorías, precios, mínimos y proveedores | `catalogo` | 1 |
| P3. Consolidar necesidades en orden de reposición (origen y destino) | `logistica` | 2 |
| P4. Empaquetar en bultos con remito y precinto | `logistica` | 2 |
| P5. Registrar despacho desde el CD | `logistica` | 2 |
| P6. Registrar recepción y verificar precinto | `logistica` | 2 |
| P7. Ventas, cobros, comprobantes y devoluciones (stock y caja) | `ventas_caja` | 3 |
| Ingreso de mercadería al CD (contexto: "integrar compras") | `ubicaciones_stock` | 1 |
| Resultado económico por período (contexto) | `catalogo` (`costo_unitario`) + `reportes` | 1 y 4 |
| V1. Stock no disponible hasta remito y bulto Verificados | `logistica` + `ubicaciones_stock` | 2 y 1 |
| V2. Trazabilidad inmutable de estados del bulto | `logistica` | 2 |
| V3. No vender más que el stock disponible y verificado | `ventas_caja` + `ubicaciones_stock` | 3 y 1 |
| V4. Sin productos ni proveedores duplicados | `catalogo` | 1 |
| V5. Devoluciones solo de ventas registradas y que cumplan las reglas | `ventas_caja` | 3 |
| Al menos 4 reportes no triviales | `reportes` | 4 |

---

## 👥 3. División de Trabajo por Integrante

### 👤 INTEGRANTE 1: Catálogo, Ubicaciones e Inventario

**Módulos:** `catalogo`, `ubicaciones_stock`
**Objetivo:** Mantener las entidades base, el stock por ubicación y el ingreso de mercadería al CD.

#### Entidades

| Entidad | Atributos principales | Notas |
|---|---|---|
| `Producto` | `codigo`, `nombre`, `precio_venta`, `costo_unitario`, `categoria`, `proveedor`, `activo` | `costo_unitario` es necesario para el margen de ganancia y la valorización del inventario. |
| `Categoria` | `id`, `nombre` | |
| `Proveedor` | `cuit`, `razon_social`, `telefono`, `email` | |
| `Ubicacion` (abstracta) | `id`, `nombre`, `direccion` | Base de `Local` y `Centro_Distribucion`. |
| `Local` | `telefono` | |
| `Centro_Distribucion` | — | Se espera uno solo en el sistema. |
| `Stock` | `producto`, `ubicacion`, `cantidad_disponible`, `cantidad_en_transito`, `nivel_minimo_existencia` | Hay **un `Stock` por cada par producto-ubicación**. El stock nunca es global. |

#### Procesos de negocio

1. **Administrar ubicaciones (P1):**
   - Dar de alta, modificar y listar locales y el CD.
   - No se puede eliminar una ubicación que tenga stock, ventas o bultos asociados: se da de baja lógica.
2. **Administrar catálogo (P2):**
   - Alta, modificación y baja lógica de productos, categorías y proveedores.
   - El cambio de `precio_venta` **no afecta ventas ya registradas** (cada venta guarda su propio precio).
   - Al dar de alta un producto se crea su `Stock` (en cero) en cada ubicación, con su `nivel_minimo_existencia`.
3. **Ingresar mercadería al CD:**
   - Carga de unidades recibidas del proveedor: suma `cantidad_disponible` al stock del CD.
   - La mercadería **solo ingresa al CD**, nunca directo a un local: los locales se abastecen únicamente por el flujo logístico.
4. **Servicio de stock para los demás módulos:** Integrante 1 es el **único dueño** de las cantidades de stock. Los otros módulos no modifican `Stock` directamente: llaman a los métodos del contrato de la sección 4.

#### Patrón Observer

- **Sujeto:** `Stock`. Cada vez que `cantidad_disponible` baja, si queda `<= nivel_minimo_existencia`, llama a `notificar()`.
- **Observadores:**
  - `Gestor_Orden_Reposicion`: si el stock es de un **local**, registra la necesidad de reposición (producto, local, cantidad sugerida = `nivel_minimo_existencia * 2 - cantidad_disponible`). La consolida Integrante 2 (P3).
  - `Alerta_Stock_Service`: registra una alerta visible en el frontend.
- **Regla:** si ya existe una necesidad pendiente para ese producto y local, no se duplica.

#### Reglas de negocio

- **Productos únicos (V4):** `codigo` único. **Proveedores únicos (V4):** `cuit` único y con formato válido (11 dígitos).
- `precio_venta`, `costo_unitario` y `nivel_minimo_existencia` deben ser mayores a cero.
- `cantidad_disponible` y `cantidad_en_transito` nunca pueden quedar negativas.

#### Excepciones

| Excepción | Cuándo se lanza |
|---|---|
| `Entidad_Duplicada_Exception` | Producto con `codigo` existente o proveedor con `cuit` existente. |
| `Datos_Invalidos_Exception` | Precio, costo o mínimo `<= 0`, o CUIT con formato inválido. |
| `Stock_Insuficiente_Exception` | Se intenta descontar más de la `cantidad_disponible`. |
| `Entidad_No_Encontrada_Exception` | Producto, proveedor o ubicación inexistente. |

---

### 👤 INTEGRANTE 2: Logística y Trazabilidad de Bultos

**Módulo:** `logistica`
**Objetivo:** Llevar la mercadería del CD a los locales con trazabilidad completa y garantizar que solo ingrese a stock vendible lo verificado.

#### Entidades

| Entidad | Atributos principales | Notas |
|---|---|---|
| `Orden_Reposicion` | `id`, `origen` (CD), `destino` (`Local`), `fecha`, `estado`, `detalles` | Estados: `PENDIENTE → EN_PREPARACION → DESPACHADA → CERRADA`. |
| `Detalle_Orden_Reposicion` | `producto`, `cantidad_solicitada`, `cantidad_enviada` | |
| `Bulto` | `id`, `orden`, `estado` (`Estado_Bulto`), `precinto`, `detalles`, `historial` | Sin setter de `estado`: solo cambia por transiciones. |
| `Detalle_Bulto` | `producto`, `cantidad` | El **contenido** del bulto. |
| `Precinto` | `codigo`, `esta_intacto` | Código único: un precinto no se reutiliza. |
| `Remito` | `numero`, `fecha_emision`, `origen`, `destino`, `bultos`, `estado` | Agrupa los bultos de un mismo despacho. |
| `Historial_Bulto` | `bulto`, `estado_anterior`, `estado_nuevo`, `fecha_hora`, `observacion` | **Solo se inserta, nunca se modifica ni borra.** Es la trazabilidad inmutable (V2). |

#### Procesos de negocio

1. **Consolidar necesidades (P3):**
   - Toma las necesidades pendientes generadas por el Observer (y las cargadas manualmente por un local).
   - Las agrupa **por local destino** en una `Orden_Reposicion` con origen CD.
   - Una misma necesidad no puede quedar en dos órdenes.
2. **Empaquetar (P4):**
   - Arma uno o más bultos por orden, con su `Detalle_Bulto`. Estado inicial: `Preparado`.
   - Al empaquetar se descuenta el stock disponible del CD (contrato `reservar_para_despacho`). Si el CD no tiene stock suficiente, no se puede empaquetar.
   - Al asignarle un precinto con código único, el bulto pasa a `Precintado`.
   - Se emite el `Remito` con todos los bultos de la orden. Solo se pueden incluir bultos `Precintado`.
3. **Despachar (P5):**
   - Se despacha el **remito completo**: todos sus bultos pasan a `En_Transito`.
   - Se suma la mercadería a `cantidad_en_transito` del local destino (contrato `registrar_en_transito`). **No** suma a `cantidad_disponible`.
4. **Recibir y verificar (P6):**
   - El local registra la recepción: cada bulto pasa a `Recibido`.
   - Por cada bulto se verifica el precinto: el código recibido debe coincidir con el registrado y estar intacto.
     - **Precinto intacto:** el bulto pasa a `Verificado`.
     - **Precinto roto o con código distinto:** el bulto pasa a `Rechazado`.
   - Cuando **todos** los bultos del remito están `Verificado` o `Rechazado`, el remito se cierra y **recién ahí** impacta el stock (V1):
     - Bultos `Verificado` → `cantidad_en_transito` pasa a `cantidad_disponible` (contrato `acreditar_verificado`).
     - Bultos `Rechazado` → `cantidad_en_transito` se descuenta como **merma** (contrato `registrar_merma`). **No habilita venta.**

#### Patrón State

```text
Preparado ──precintar──▶ Precintado ──despachar──▶ En_Transito ──recibir──▶ Recibido ──verificar──▶ Verificado
                                                                                     └─────────────▶ Rechazado
```

- `Estado_Bulto` (base) define `precintar`, `despachar`, `recibir` y `verificar`. Por defecto **todas** lanzan `Transicion_Estado_Invalida_Exception`.
- Cada estado concreto sobrescribe **solo** las acciones que admite.
- `Verificado` y `Rechazado` son **finales**: no admiten ninguna acción.
- Cada transición agrega una fila en `Historial_Bulto` con fecha y hora. Esto también alimenta el reporte de tiempo de tránsito.

#### Reglas de negocio

- Un estado no puede retroceder ni saltearse pasos (V2).
- No se puede despachar un remito con algún bulto que no esté `Precintado`.
- Un bulto vacío (sin `Detalle_Bulto`) no se puede precintar.
- Lo enviado en una orden no puede superar lo solicitado.

#### Excepciones

| Excepción | Cuándo se lanza |
|---|---|
| `Transicion_Estado_Invalida_Exception` | Acción no permitida en el estado actual (ej. recibir un bulto `Preparado`). |
| `Precinto_Invalido_Exception` | Código de precinto inexistente o ya usado en otro bulto. |
| `Bulto_Vacio_Exception` | Se intenta precintar un bulto sin contenido. |
| `Remito_Incompleto_Exception` | Se intenta despachar un remito con bultos no precintados. |

---

### 👤 INTEGRANTE 3: Ventas, Cobros, Caja y Devoluciones

**Módulo:** `ventas_caja`
**Objetivo:** Punto de venta con cobro dinámico, comprobantes, impacto en caja y devoluciones controladas.

#### Entidades

| Entidad | Atributos principales | Notas |
|---|---|---|
| `Venta` | `id`, `fecha_hora`, `local`, `detalles`, `total`, `metodo_de_pago` | |
| `Detalle_Venta` | `producto`, `cantidad`, `precio_unitario` | `precio_unitario` se **copia** del producto al vender (precio histórico). |
| `Comprobante` | `numero`, `venta`, `fecha_emision`, `total`, `medio_de_pago` | Numeración correlativa **por local**. |
| `Devolucion` | `id`, `venta`, `fecha_hora`, `detalles`, `monto_reintegrado`, `motivo` | |
| `Detalle_Devolucion` | `detalle_venta`, `cantidad` | Apunta a la línea original de la venta. |

#### Procesos de negocio (P7)

1. **Registrar venta:**
   - Una venta tiene uno o más productos. Si el mismo producto se carga dos veces, se unifica en una sola línea.
   - Se valida el stock de **todas** las líneas antes de descontar nada: si una sola línea no alcanza, **se rechaza la venta completa** (V3).
   - Se descuenta stock con el contrato `descontar_por_venta` (que puede disparar el Observer).
   - Venta, stock y comprobante se guardan en **una única transacción**.
2. **Cobrar (Strategy):** `Venta` delega el cobro en su `metodo_de_pago`:
   - `Pago_Efectivo`: recibe `monto_recibido`; debe ser `>= total` y calcula el vuelto.
   - `Pago_Tarjeta`: valida número de tarjeta y cuotas (1, 3, 6 o 12) y aplica el recargo por cuotas definido por el equipo (ej. 0% / 10% / 20% / 35%).
   - `Pago_Transferencia`: registra CBU o alias y código de transacción (obligatorio).
   - El monto cobrado suma a la caja del local.
3. **Emitir comprobante:** se emite al confirmar la venta, con el detalle de los ítems, el total y el medio de pago.
4. **Gestionar devoluciones (V5):**
   - Debe referenciar una venta registrada **del mismo local**.
   - Se admiten devoluciones parciales y varias por venta, pero la **suma devuelta** de cada línea no puede superar lo comprado.
   - **Reglas definidas por el equipo** (la consigna pide "reglas establecidas"): plazo máximo de 30 días desde la venta y reintegro por el mismo medio de pago.
   - **Impacto:** la mercadería vuelve a `cantidad_disponible` (contrato `reingresar_por_devolucion`) y el monto reintegrado se resta de la caja del local.
5. **Caja del local:** no es una entidad aparte. El saldo de caja de un local en un período se **calcula** como `ventas cobradas - devoluciones reintegradas`.

#### Excepciones

| Excepción | Cuándo se lanza |
|---|---|
| `Stock_Insuficiente_Exception` | Alguna línea supera el stock disponible del local. |
| `Venta_No_Encontrada_Exception` | Devolución sobre una venta inexistente o de otro local. |
| `Devolucion_Invalida_Exception` | Cantidad mayor a la comprada (acumulada), producto ajeno a la venta o plazo vencido. |
| `Pago_Rechazado_Exception` | Efectivo insuficiente, cuotas inválidas o transferencia sin código. |

---

### 👤 INTEGRANTE 4: Persistencia Base, Seed Data y Reportes

**Módulo:** `reportes` + `backend/src/config/`
**Objetivo:** Proveer la base SQLite que usan todos, datos de prueba realistas y los reportes no triviales.

#### Responsabilidades

1. **Esquema (`schema.sql`):** tablas de todas las entidades de los módulos, con claves primarias, foráneas y restricciones `UNIQUE` (`producto.codigo`, `proveedor.cuit`, `precinto.codigo`). **Es lo primero que se hace** y lo acuerdan los 4 (ver sección 5).
2. **Conexión:** `sqlite_connection()` en `config/database.py` (ya existe). Una conexión = una transacción.
3. **Seed data:** 1 CD, 3 locales, 3 categorías, 3 proveedores, 10 productos, stock inicial en el CD, al menos 2 remitos completos (uno con un bulto rechazado), ventas de 3 meses distintos con los 3 medios de pago y una devolución. Sin esto, los reportes no muestran nada interesante.
4. **Reportes:** solo **leen** (`SELECT`). Nunca modifican datos.

#### Reportes (la consigna pide al menos 4 no triviales)

Un reporte es **no trivial** cuando cruza varias entidades, agrupa y calcula. Un listado de una sola tabla **no** cuenta.

| # | Reporte | Filtros | Resultado | Fuente de datos |
|---|---|---|---|---|
| 1 | **Ventas e ingresos por período, local y medio de pago** | rango de fechas, local (opcional) | Por local y medio de pago: cantidad de ventas, total bruto, devoluciones y total neto. | `Venta`, `Devolucion` |
| 2 | **Productos más vendidos y margen estimado** | rango de fechas, top N | Por producto: unidades netas vendidas, ingresos, costo (`costo_unitario × unidades`), margen `$` y margen `%`. Marca en rojo los de margen negativo. | `Detalle_Venta`, `Producto` |
| 3 | **Existencias actuales y stock mínimo** | ubicación (opcional) | Por producto y ubicación: disponible, en tránsito, mínimo, faltante y valorización (`disponible × costo_unitario`). Destaca los que están en o bajo el mínimo. | `Stock`, `Producto` |
| 4 | **Bultos rechazados y mermas** | rango de fechas, local destino | Por bulto rechazado: remito, local, productos, unidades perdidas, valor perdido. Totales por local. | `Bulto`, `Detalle_Bulto`, `Historial_Bulto`, `Producto` |
| 5 | **Tiempo promedio de tránsito CD → locales** _(opcional)_ | rango de fechas | Por local: promedio, mínimo y máximo de horas entre `En_Transito` y `Recibido`. | `Historial_Bulto` |

> El reporte 5 sale casi gratis gracias al historial inmutable del bulto. Implementarlo suma puntos y demuestra que la trazabilidad sirve para algo más que cumplir.

#### Excepciones

| Excepción | Cuándo se lanza |
|---|---|
| `Rango_Fechas_Invalido_Exception` | Fecha de inicio posterior a la fecha de fin. |
| `Persistencia_Exception` | Error de lectura/escritura en SQLite. Es técnica: **no** hereda de `BusinessError`. |

---

## 🔌 4. Contratos entre Módulos

Los módulos se comunican **solo** a través de servicios de `application/`. Estas firmas se acuerdan antes de programar y **no se cambian sin avisar al equipo**.

| Servicio (dueño) | Método | Lo usa | Efecto |
|---|---|---|---|
| `Stock_Service` (Int. 1) | `reservar_para_despacho(producto, cd, cantidad)` | Logística | Descuenta disponible del CD. |
| `Stock_Service` (Int. 1) | `registrar_en_transito(producto, local, cantidad)` | Logística | Suma `cantidad_en_transito` en el local. |
| `Stock_Service` (Int. 1) | `acreditar_verificado(producto, local, cantidad)` | Logística | Tránsito → disponible. |
| `Stock_Service` (Int. 1) | `registrar_merma(producto, local, cantidad)` | Logística | Descuenta tránsito como pérdida. |
| `Stock_Service` (Int. 1) | `consultar_disponible(producto, local)` | Ventas | Devuelve la cantidad vendible. |
| `Stock_Service` (Int. 1) | `descontar_por_venta(producto, local, cantidad)` | Ventas | Descuenta disponible (dispara el Observer). |
| `Stock_Service` (Int. 1) | `reingresar_por_devolucion(producto, local, cantidad)` | Ventas | Suma disponible. |
| `Reposicion_Service` (Int. 2) | `registrar_necesidad(producto, local, cantidad)` | Observer (Int. 1) | Crea una necesidad pendiente. |

Todos los métodos que modifican stock reciben la `connection` de la transacción del caso de uso que los llama (ver [convenciones.md](convenciones.md), sección 8).

---

## 📅 5. Orden de Trabajo

| Fase | Qué se hace | Quién | Bloquea a |
|---|---|---|---|
| **0. Acuerdos** | Modelo de clases final, `schema.sql` y firmas de la sección 4. | Los 4 juntos | Todos |
| **1. Base** | Catálogo, ubicaciones, stock + Observer. Conexión y seed inicial. | Int. 1 y 4 | Logística y ventas |
| **2. Flujos** | Logística completa (State) y ventas/caja (Strategy), en paralelo. | Int. 2 y 3 | Reportes |
| **3. Reportes** | Los 4 (o 5) reportes sobre datos reales del seed. | Int. 4 | — |
| **4. Integración** | Recorrer el happy path de la sección 6 de punta a punta. | Los 4 | Entrega |

> Mientras las fases 1 y 2 avanzan, Integrante 4 puede escribir las consultas de los reportes contra el seed.

---

## 🔄 6. Flujo Integrado de Prueba (Happy Path de Evaluación)

Secuencia para demostrar el sistema completo ante la cátedra:

1. **Catálogo (Int. 1):** registrar proveedores, categorías y productos con precio, costo y nivel mínimo. Intentar duplicar un producto → `Entidad_Duplicada_Exception`.
2. **Ingreso al CD (Int. 1):** cargar mercadería en el CD → sube su stock disponible.
3. **Alerta de stock (Int. 1):** vender en un local hasta que `cantidad_disponible <= nivel_minimo_existencia` → el **Observer** registra la necesidad de reposición.
4. **Consolidar y empaquetar (Int. 2):** crear la orden de reposición CD → local, armar 2 bultos, precintarlos y emitir el remito (**State: Preparado → Precintado**).
5. **Despachar (Int. 2):** despachar el remito (**State: En_Transito**). Comprobar que el local muestra el stock **en tránsito**, pero **no disponible**. Intentar vender esa mercadería → `Stock_Insuficiente_Exception`.
6. **Recepción y verificación (Int. 2):**
   - Bulto 1 con precinto intacto → **Verificado**.
   - Bulto 2 con precinto roto → **Rechazado**.
   - Al cerrar el remito: el stock disponible del local sube **solo** por el bulto 1, y el bulto 2 queda como merma.
   - Intentar despachar de nuevo el bulto 1 → `Transicion_Estado_Invalida_Exception`.
7. **Venta y cobro (Int. 3):** vender varios productos con cada medio de pago (**Strategy**). Comprobar que baja el stock, se emite el comprobante y sube la caja.
8. **Devolución (Int. 3):** devolver parte de una venta → vuelve el stock y baja la caja. Intentar devolver más de lo comprado → `Devolucion_Invalida_Exception`.
9. **Reportes (Int. 4):** ejecutar los reportes y verificar que reflejen exactamente las operaciones anteriores (ventas por medio de pago, merma del bulto 2, stock bajo mínimo, etc.).

---

## ➕ 7. Procesos Opcionales (si sobra tiempo)

La consigna los lista como opcionales. Están en orden de **menor esfuerzo / mayor reutilización** de lo ya construido:

1. **Órdenes de compra sugeridas por faltantes:** reutiliza el Observer, aplicado al stock del **CD**. (Int. 1)
2. **Promociones y descuentos:** encaja como un nuevo Strategy o como un Decorator sobre el cálculo del total. (Int. 3)
3. **Inventario físico y conciliación:** compara un conteo manual contra `Stock` y ajusta la diferencia. (Int. 1)
