# ERP AYA · Especificación de Producto, Historias de Usuario y Flujos (`PRODUCT.md`)

> **Stocky feature authority (2026-10-20):** `specs/001-stocky-operational-ux/spec.md` is the approved scope for the redesign. It adds authenticated Administrator/Operator experiences, one complete delivery note per order, package approval evidence, batch seal control, live traceability, professional R1/R2 PDFs, and the integration of the Sales/Cash UI with the official persisted backend merged from `main`.

> **Ubicación canónica:** `frontend/PRODUCT.md`  
> **Fuentes de verdad:** `docs/tema3.pdf` (Consigna Oficial TP Integrador 2026 · Tema 3) · `docs/implementacion.md` · `docs/convenciones.md` · `docs/specs/`  
> **Idea central de la consigna:** *"Nada ingresa a stock vendible sin verificación."*

---

## 1. Procesos de Negocio Obligatorios (`docs/tema3.pdf`)

| Código | Proceso de Negocio | Módulo Dueño | Integrante | Pantallas y Flujos en el Frontend React |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | Administrar sucursales (`Local`) y `Centro_Distribucion` (CD). | `ubicaciones_stock` | Integrante 1 | Pestaña **Ubicaciones (CD y Locales)**: tabla con filtro activas/inactivas, `Drawer` de Alta/Edición de CD o Local, y baja lógica con `ConfirmMorph`. |
| **P2** | Administrar `Producto`, `Categoria`, precios (`precio_venta`, `costo_unitario`), `nivel_minimo_existencia` y `Proveedor`. | `catalogo` | Integrante 1 | Pestañas **Productos**, **Proveedores** y **Categorías**: CRUD completo con validación de SKU único y CUIT único (11 dígitos), actualización de precio sin alterar ventas históricas, e inicialización automática de `Stock` en `0` en cada ubicación al crear un producto. |
| **Compras CD** | Ingresar mercadería de proveedor exclusivamente en el `Centro_Distribucion`. | `ubicaciones_stock` | Integrante 1 | Modal **Ingresar mercadería al CD** (`POST /api/stock/ingreso-cd`): habilitado únicamente cuando el contexto activo es `CD Central`. |
| **Observer** | Detectar `cantidad_disponible <= nivel_minimo_existencia` y disparar `Alerta_Stock_Service` + `Gestor_Orden_Reposicion` (`sugerido = mínimo × 2 - disponible`). | `ubicaciones_stock` | Integrante 1 | Pestaña **Alertas y Necesidades Observer**: listado de alertas y necesidades pendientes sin duplicación por par `(producto, local)`. |
| **P3** | Consolidar necesidades de los locales en una `Orden_Reposicion` (`PENDIENTE -> EN_PREPARACION -> DESPACHADA -> CERRADA`) indicando origen (CD) y destino (Local). | `logistica` | Integrante 2 | Pestaña **1. Órdenes de reposición (P3)**: agrupa las necesidades del Observer o manuales por `Local` destino y genera la `Orden_Reposicion`. |
| **P4** | Empaquetar mercadería en uno o más `Bulto` con `Detalle_Bulto` (`Preparado`), descontar stock del CD (`reservar_para_despacho`), asignar `Precinto` único (`Precintado`) y emitir `Remito`. | `logistica` | Integrante 2 | Pestaña **2. Empaquetado, bultos y precintos (P4)**: armado de bultos por orden, asignación de código único de `Precinto` y emisión de `Remito`. |
| **P5** | Registrar el despacho del `Remito` completo desde el CD: todos sus bultos pasan a `En_Transito` y suman a `cantidad_en_transito` del Local destino (`registrar_en_transito`). | `logistica` | Integrante 2 | Acción **Despachar remito completo (P5)** en el tablero de Remitos e Inspector de Bulto. |
| **P6** | Registrar la recepción en el Local destino (`Recibido`) y verificar cada `Precinto` (`Verificado` si está intacto, `Rechazado` si llega roto o con código distinto). Al cerrar el `Remito`, acreditar disponibles (`acreditar_verificado`) e imputar mermas (`registrar_merma`). | `logistica` | Integrante 2 | `Drawer` **Inspector de recepción y verificación de precinto (P6)** con `BultoStepper` e historial inmutable `Historial_Bulto`. |
| **P7** | Registrar `Venta` (unificando líneas repetidas y validando stock total antes de descontar), cobrar con `Strategy` (`Pago_Efectivo`, `Pago_Tarjeta` 1/3/6/12 cuotas con recargo 0%/10%/20%/35%, `Pago_Transferencia`), emitir `Comprobante` correlativo por local, gestionar `Devolucion` (parcial o total acumulada, <= 30 días) y calcular la **Caja del Local** (`ventas cobradas - devoluciones reintegradas`). | `ventas_caja` | Integrante 3 | Pestañas **Terminal POS Minorista**, **Comprobantes y Caja del Local** y **Devoluciones (V5)**. |
| **Reportes** | Ejecutar los **5 reportes no triviales** de solo lectura con `pandas` y gráficos `Plotly`. | `reportes` | Integrante 4 | Pestañas **R1. Ventas y Caja**, **R2. Top Productos y Margen**, **R3. Existencias y Valorización**, **R4. Mermas por Precinto** y **R5. Tiempo de Tránsito**. |

---

## 2. Validaciones de Negocio (`V1` a `V5`) y Excepciones Soportadas en la UI

La interfaz previene y traduce visualmente mediante `Alert` todas las excepciones de dominio definidas en `docs/implementacion.md`:

| Validación / Excepción | Regla de Dominio | Respuesta Visual en el Frontend |
| :--- | :--- | :--- |
| **V1 · Stock verificado** | El stock en tránsito no es vendible hasta que todos los bultos del `Remito` estén en `Verificado` o `Rechazado` y el remito cierre. | `StockSplitBar` separa `Disponible` (verde) de `En tránsito` (ámbar). El POS bloquea la venta de unidades en tránsito. |
| **V2 · Trazabilidad inmutable (`Transicion_Estado_Invalida_Exception`)** | Secuencia estricta `Preparado -> Precintado -> En_Transito -> Recibido -> Verificado / Rechazado`. Sin retrocesos ni saltos. | `BultoStepper` habilita únicamente la transición admitida por el estado actual y muestra un simulador de intento de transición inválida. |
| **V3 · Stock suficiente (`Stock_Insuficiente_Exception`)** | Ni el empaquetado en CD ni una venta en Local pueden superar `cantidad_disponible`. En ventas, si una línea no alcanza, se rechaza la venta completa. | Validación previa por lote y alerta `danger` detallando el SKU y el faltante exacto. |
| **V4 · Identificadores únicos (`Entidad_Duplicada_Exception`, `Datos_Invalidos_Exception`)** | `Producto.codigo` único, `Proveedor.cuit` único de 11 dígitos, `Precinto.codigo` único no reutilizable, y precios/costos/mínimos `> 0`. | Validación inline en los campos del `Drawer` y banner `Alert` HTTP 409 / 400. |
| **V5 · Devoluciones controladas (`Devolucion_Invalida_Exception`, `Venta_No_Encontrada_Exception`)** | Solo sobre ventas del mismo local, dentro de los 30 días, y la suma devuelta acumulada por línea nunca supera la cantidad comprada. | Muestra para cada línea de la venta: `Comprado`, `Ya devuelto` y `Máximo disponible para devolver`. |

---

## 3. Mapa de Historias de Usuario (`HU-01` a `HU-16`)

1. **HU-01 (`catalogo`):** Alta, edición de precio (`PATCH /api/catalogo/productos/{codigo}/precio`) y baja lógica de `Producto` con creación automática de `Stock` en `0` en todas las ubicaciones.
2. **HU-02 (`catalogo`):** Alta, modificación (`PUT`) y baja lógica (`DELETE`) de `Proveedor` validando CUIT único de 11 dígitos.
3. **HU-03 (`catalogo`):** Alta y listado de `Categoria` de productos.
4. **HU-04 (`ubicaciones_stock`):** Alta, modificación y baja lógica de `Centro_Distribucion` y sucursales `Local`.
5. **HU-05 (`ubicaciones_stock`):** Ingreso de mercadería de proveedor exclusivamente en el `CD Central` (`POST /api/stock/ingreso-cd`).
6. **HU-06 (`ubicaciones_stock`):** Disparo automático del **Observer** (`Alerta_Stock_Service` + `Gestor_Orden_Reposicion`) cuando `cantidad_disponible <= nivel_minimo_existencia`.
7. **HU-07 (`logistica`):** Consolidación de necesidades pendientes por `Local` destino en una `Orden_Reposicion` (`P3`).
8. **HU-08 (`logistica`):** Empaquetado de `Bulto` con `Detalle_Bulto` (`reservar_para_despacho`), colocación de `Precinto` único y emisión de `Remito` (`P4`).
9. **HU-09 (`logistica`):** Despacho de `Remito` completo desde el CD pasando todos sus bultos a `En_Transito` (`registrar_en_transito`, `P5`).
10. **HU-10 (`logistica`):** Recepción en Local (`Recibido`), verificación de código e integridad de `Precinto` (`Verificado` vs `Rechazado`) y cierre de `Remito` con impacto en disponible y merma (`P6`, `V1`, `V2`).
11. **HU-11 (`ventas_caja`):** Registro de `Venta` en Local unificando productos repetidos, validando stock total (`V3`) y cobrando con **Strategy** (`Pago_Efectivo`, `Pago_Tarjeta` 1/3/6/12 cuotas con 0%/10%/20%/35%, `Pago_Transferencia`).
12. **HU-12 (`ventas_caja`):** Emisión de `Comprobante` correlativo por local y arqueo en vivo de la **Caja del Local** (`ventas cobradas - devoluciones reintegradas`).
13. **HU-13 (`ventas_caja`):** Registro de `Devolucion` parcial o total acumulada dentro de los 30 días (`V5`), reintegrando stock disponible y descontando de la caja por el mismo medio de pago.
14. **HU-14 (`reportes`):** Reportes R1 (Ventas e ingresos netos por local y medio de pago) y R2 (Productos más vendidos y margen `$` / `%`).
15. **HU-15 (`reportes`):** Reportes R3 (Existencias actuales, faltantes y valorización `disponible × costo_unitario`), R4 (Bultos rechazados y mermas valorizadas) y R5 (Tiempo promedio, mínimo y máximo de tránsito CD -> Locales).
16. **HU-16 (Transversal):** Recorrido guiado interactivo de los **9 pasos del Happy Path de Evaluación** (Sección 6 de `docs/implementacion.md`).
