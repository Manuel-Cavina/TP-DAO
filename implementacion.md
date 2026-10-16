# TP Integrador 2026 - Tema 3: Sistema de Ventas e Inventario (Centro de Distribución a Locales)

Sistema integral orientado a objetos para la gestión de compras, logística interna, ventas, control de inventario y análisis económico entre un Centro de Distribución (CD) y sus sucursales/locales.

---

## 🏗️ Arquitectura y Tecnologías
* **Lenguaje/Entorno:** Multiplataforma (C# / Java / Python / JS según stack elegido).
* **Persistencia:** SQLite.
* **Patrones de Diseño Obligatorios:** 
  1. **State:** Manejo inmutable del ciclo de vida del bulto/contenedor.
  2. **Strategy:** Estrategias de cobro en ventas (Efectivo, Tarjeta, Transferencia).
  3. **Observer:** Detección de stock mínimo y notificación para orden de reposición.
* **Estructura del Proyecto:** Arquitectura en Capas (`domain`, `application`, `infrastructure`, `presentation`).

---

## 👥 División de Trabajo y Asignación por Integrante

---

### 👤 INTEGRANTE 1: Módulo Catálogo, Ubicaciones e Inventario
**Objetivo:** Gestionar las entidades base del sistema, el stock por ubicación y el sistema de alertas por stock mínimo.

#### 📋 Responsabilidades:
1. **Proceso 1:** Administrar sucursales/locales y Centro de Distribución (CD).
2. **Proceso 2:** Administrar productos, categorías, precios, niveles mínimos de existencia y proveedores.
3. **Patrón Observer:** Implementar la notificación automática cuando el stock caiga por debajo del mínimo.

#### ⚙️ Reglas de Negocio a Cumplir:
* **Entidades Duplicadas:** Evitar productos o proveedores duplicados según sus identificadores únicos (CUIT/Código de Producto).
* **Control de Stock por Ubicación:** El stock no es global; pertenece a una `Ubicacion` específica (`Local` o `CentroDistribucion`).
* **Sujeto Observable (`Stock`):** Al descontar unidades, si `cantidadDisponible <= nivelMinimoExistencia`, invoca `notificar()` a todos los observadores registrados (`GestorOrdenReposicion`, `AlertaStockService`).

#### 🚨 Excepciones a Manejar:
* `EntidadDuplicadaException`: Lanzada al intentar registrar un producto con un código ya existente o un proveedor con CUIT duplicado.
* `DatosInvalidosException`: Lanzada si se ingresan precios o niveles mínimos de stock menores o iguales a cero.

---

### 👤 INTEGRANTE 2: Módulo Logística y Trazabilidad de Bultos
**Objetivo:** Implementar la consolidación de necesidades, empaquetado, despacho, recepción y verificación de precintos.

#### 📋 Responsabilidades:
1. **Proceso 3:** Consolidar necesidades de los locales en una orden de reposición hacia el CD (origen y destino).
2. **Proceso 4:** Empaquetar mercadería en bultos/contenedores, asignando remito de despacho y precinto de seguridad.
3. **Proceso 5:** Registrar el despacho de los bultos desde el CD.
4. **Proceso 6:** Registrar la recepción en el local destino, verificando que el precinto no haya sido violado.
5. **Patrón State:** Ciclo de vida inmutable de los bultos.

#### ⚙️ Reglas de Negocio a Cumplir:
* **Inmutabilidad y Secuencia de Estados (Patrón State):**
  Un bulto solo puede transicionar de forma secuencial:  
  `Preparado` $\rightarrow$ `Precintado` $\rightarrow$ `En tránsito` $\rightarrow$ `Recibido` $\rightarrow$ `Verificado` / `Rechazado`.
* **Regla Crítica de Stock:** 
  * La mercadería enviada **NO impacta como Disponible** en el local destino mientras esté en tránsito o recibido.
  * **Transición a `Verificado` (Precinto Intacto):** Se suma la cantidad al `stockDisponible` del local destino.
  * **Transición a `Rechazado` (Precinto Roto/Violado):** La mercadería pasa a pérdida/merma logística y **NO habilita venta**.

#### 🚨 Excepciones a Manejar:
* `TransicionEstadoInvalidaException`: Lanzada si se intenta ejecutar una acción no permitida para el estado actual del bulto (ej. recibir un bulto que está en estado `Preparado`).
* `PrecintoInvalidoException`: Lanzada si el código de precinto no existe o ya fue utilizado en otro bulto.

---

### 👤 INTEGRANTE 3: Módulo Ventas, Cobros y Devoluciones
**Objetivo:** Implementar el punto de venta (POS), la pasarela de cobros dinámica y el control estricto de devoluciones.

#### 📋 Responsabilidades:
1. **Proceso 7:** Registrar ventas (con uno o más productos), cobros con medios de pago, emisión de comprobantes y gestión de devoluciones con impacto en stock y caja.
2. **Patrón Strategy:** Formas de cobro dinámicas.

#### ⚙️ Reglas de Negocio a Cumplir:
* **Validación de Stock en Venta:** No vender cantidades superiores al `stockDisponible` y `Verificado` en el local donde se realiza la venta.
* **Estrategia de Cobro (Patrón Strategy):**
  * `PagoEfectivo`: Impacta directamente en el saldo de caja del local.
  * `PagoTarjeta`: Valida número de tarjeta, cuotas y aplica recargo correspondiente.
  * `PagoTransferencia`: Registra el CBU/Alias y el código de transacción.
* **Emisión de Comprobantes:** Cada venta genera un comprobante con el detalle de items, total y medio de pago usado.
* **Validación de Devoluciones:**
  * No aceptar devoluciones que no correspondan a una venta previamente registrada.
  * Verificar que la cantidad a devolver no supere la cantidad comprada en dicha venta.
  * Impacto: Al aceptar la devolución, la cantidad se reingresa al `stockDisponible` y se resta del total en caja.

#### 🚨 Excepciones a Manejar:
* `StockInsuficienteException`: Lanzada si se intenta vender más de lo disponible en la sucursal.
* `VentaNoEncontradaException`: Lanzada si se intenta procesar una devolución de una venta inexistente.
* `DevolucionInvalidaException`: Lanzada si la cantidad a devolver supera lo comprado o si el producto no formaba parte de la venta.

---

### 👤 INTEGRANTE 4: Módulo de Reportes, SQLite Base y Dashboard
**Objetivo:** Proveer la capa de persistencia base con SQLite, cargar datos iniciales de prueba (Seed Data) e implementar los 4 reportes no triviales.

#### 📋 Responsabilidades:
1. **Configuración Inicial:** Script SQL de creación de tablas (`schema.sql`) y conexión a SQLite.
2. **Seed Data (Fixtures):** Cargar datos de prueba iniciales (1 CD, 2 Locales, productos, ventas, bultos rechazados) para facilitar el testing.
3. **Implementar los 4 Reportes No Triviales:**

#### ⚙️ Reportes Requeridos:
1. **Ventas e Ingresos por Período, Local y Medio de Pago:**
   * Filtra por rango de fechas, agrupa por local y clasifica los totales por cada `EstrategiaPago` utilizada.
2. **Productos Más Vendidos y Margen de Ganancia/Pérdida Estimado:**
   * Top $N$ de productos por unidades vendidas, comparando el precio de venta vs. costo de adquisición.
3. **Existencias Actuales y Alerta de Productos en Stock Mínimo:**
   * Muestra el stock disponible actual comparándolo con `nivelMinimoExistencia`.
4. **Bultos Rechazados o Mermas por Rotura de Precinto Logístico:**
   * Listado de bultos en `EstadoRechazado`, detallando productos afectados, valor económico perdido y local destino.

#### 🚨 Excepciones a Manejar:
* `PersistenciaException`: Lanzada cuando ocurre un error de lectura/escritura en la base de datos SQLite.
* `RangoFechasInvalidoException`: Lanzada al solicitar un reporte con fecha de inicio posterior a la fecha de fin.

---

## 🔄 Flujo Integrado de Prueba (Happy Path de Evaluación)

 Para validar que todo funciona de forma integrada, seguir esta secuencia:

1. **Creación de Catálogo:** Registrar Proveedores, Productos y Niveles Mínimos (Integrante 1)[cite: 4].
2. **Alerta de Stock:** Descontar stock hasta que `cantidadDisponible <= nivelMinimo` para que el **Observer** emita la orden de reposición (Integrante 1)[cite: 4].
3. **Empaquetado y Despacho:** En el CD, consolidar la orden, empaquetar el `Bulto`, asignarle `Precinto` y `Remito` (**State: Preparado $\rightarrow$ Precintado $\rightarrow$ En Tránsito**) (Integrante 2)[cite: 4].
4. **Recepción y Verificación:**
   * **Caso Exitoso:** Recibir bulto con precinto intacto (**State: Verificado**). Verificar que el stock del local **incremente** (Integrante 2)[cite: 4].
   * **Caso Fallido:** Recibir bulto con precinto roto (**State: Rechazado**). Verificar que el stock del local **NO incremente** y se contabilice la merma (Integrante 2)[cite: 4].
5. **Venta y Cobro:** Realizar una venta en el local seleccionando el medio de pago (**Strategy**). Verificar la deducción del stock y el incremento en caja (Integrante 3)[cite: 4].
6. **Devolución:** Solicitar la devolución asociando el ID de la venta registrada (Integrante 3)[cite: 4].
7. **Reportes:** Ejecutar los 4 reportes y verificar que reflejen con precisión las operaciones realizadas (Integrante 4)[cite: 4].