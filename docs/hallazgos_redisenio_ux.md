# Hallazgos de implementación y UX: Stocky ERP

**Fecha:** 2026-10-19  
**Fuente de aceptación:** `docs/redisenio_ux_operativo.md`  
**Estado:** diagnóstico. No se aplicaron cambios funcionales como parte de este relevamiento.

## Método y evidencia

- Backend iniciado en `http://127.0.0.1:8000` y frontend Vite en `http://127.0.0.1:5173`.
- Revisión de código de frontend, dominio y servicios de logística.
- Capturas Playwright de `/stock/stock`:
  - Desktop: `tmp/stocky-desktop-before.png` (1440 × 900, página completa).
  - Móvil: `tmp/stocky-mobile-before.png` (iPhone 13, viewport).
- Chequeos ya ejecutados y aprobados: estructura, convenciones, suite backend (35 tests), `npm run check` y build del frontend.

## Resumen ejecutivo

La base visual y varios flujos de logística ya existen: hay tokens semánticos, modo oscuro, foco visible, componentes compartidos, wizard de orden, empaquetado, checklist de recepción y reportes imprimibles. Sin embargo, el rediseño operativo no está completo: faltan pantallas y contratos centrales, y hay una transición crítica de recepción que permite que la interfaz ofrezca una acción que el backend ya no debería aceptar.

| Prioridad | Hallazgos | Riesgo principal |
|---|---:|---|
| P0 | 5 | Stock disponible acreditado sin el flujo documental requerido, recepción repetible en UI y ventas sin operación persistente |
| P1 | 9 | Flujos incompletos o sin guías/bloqueos suficientes para la operación diaria |
| P2 | 5 | Consistencia visual, recuperabilidad y calidad de interacción |

## P0: corregir antes de ampliar la interfaz

### 1. La recepción no cambia el estado documental del remito

**Regla afectada:** `Despachado → Recibido → Verificado/Rechazado → Cerrado`; nunca debe mostrarse una acción que el backend rechazará.

**Evidencia:**

- `Remito.recibir()` pasa los bultos a `RECIBIDO`, pero no cambia `Remito.estado` desde `DESPACHADO`.
- `Remito.cerrar()` todavía exige el estado `DESPACHADO`.
- `remito_repository._estado_dominio()` normaliza incorrectamente `RECIBIDO` como `DESPACHADO`.
- `RecepcionPage` vuelve a presentar “Registrar recepción” después de la llegada.

**Corrección propuesta:**

| Acción | Estado anterior | Estado posterior |
|---|---|---|
| Despachar | `EMITIDO` | `DESPACHADO` |
| Registrar recepción | `DESPACHADO` | `RECIBIDO` |
| Verificar/rechazar | `RECIBIDO` | `RECIBIDO` |
| Cerrar | `RECIBIDO` + todos los bultos resueltos | `CERRADO` |

El segundo `POST /remitos/{numero}/recibir` debe devolver error de negocio, no éxito idempotente: evita ocultar una repetición operativa.

**Archivos dueños:**

- `backend/src/modules/logistica/domain/remito.py`
- `backend/src/modules/logistica/application/recepcion_service.py`
- `backend/src/modules/logistica/infrastructure/remito_repository.py`
- `frontend/src/modules/logistica/pages/RecepcionPage.jsx`
- `frontend/src/modules/logistica/pages/LogisticaPage.jsx`
- `frontend/src/modules/logistica/pages/RemitoDetallePage.jsx`
- pruebas de logística de dominio, servicio, repositorio y API.

### 2. No existe Inicio operativo ni inbox priorizada

**Regla afectada:** Inicio debe mostrar inbox con una acción de resolución, últimos movimientos e indicadores que abren listas filtradas.

**Evidencia:** el índice redirige a `/stock/stock`; no existe ruta o página de Inicio. El botón actual “Alertas: 2” lleva a alertas de stock y no constituye una inbox. El contador también está fijado en la navegación.

**Archivos dueños:** `frontend/src/app/router.jsx`, `frontend/src/shared/components/AppShell.jsx` y una nueva pantalla/módulo de inicio con su read model.

### 3. El ingreso al CD acredita disponible sin confirmación documental

**Regla afectada:** ningún movimiento se vuelve disponible sin documento de origen, cantidades y confirmación; los ingresos deben pasar por pendiente de confirmar.

**Evidencia:** `IngresoCdModal` admite comprobante opcional y el flujo actual incrementa stock disponible de inmediato. La pantalla describe el impacto inmediato y sólo conserva una referencia de sesión, no historial documental persistente.

**Archivos dueños:** `frontend/src/modules/ubicaciones_stock/components/IngresoCdModal.jsx`, `frontend/src/modules/ubicaciones_stock/pages/IngresosPage.jsx`, contrato/API y dominio de stock.

### 4. No existe ficha única de producto

**Regla afectada:** Producto debe ser la fuente de verdad con tabs General, Precio y mínimo, Stock por sede, Movimientos e Historial.

**Evidencia:** Productos es una tabla con drawer de alta/edición y modal de precio. No muestra el saldo multisedes, los movimientos ni auditoría de cambios de precio/mínimo.

**Archivos dueños:** `frontend/src/modules/catalogo/pages/ProductosPage.jsx`, `components/ProductoDrawer.jsx`, nuevos read models de stock/movimientos e historial.

### 5. Ventas y caja permanecían en demo local — Resuelto en la integración 2026-10-20

**Regla afectada:** venta valida stock total de todas las líneas; venta y devolución dejan stock, caja e historial coherentes.

**Evidencia de resolución:** `VentasCajaPage` y `ventasService` consumen `/api/ventas`, comprobantes, devoluciones anidadas y `/api/caja`; el POS usa disponibilidad por local y la devolución descuenta cantidades ya reintegradas. No queda persistencia de Ventas/Caja en `localStorage`.

**Archivos dueños:** backend oficial `modules/ventas_caja` proveniente de `main`, frontend `modules/ventas_caja` e integración con Stock/Logística. Autorización, idempotencia y confirmación externa de pagos permanecen como bloqueos de producción en el plan.

## P1: completar los flujos operativos

### Inventario, maestros y navegación

1. **Matriz de saldos incompleta.** Sólo expone disponible, tránsito y mínimo. Faltan reservado, pendiente de confirmar y merma, con semántica no vendible. Dueños: `StockPage`, `StockSplitBar`, read model/API de stock.
2. **Ingresos sin tabs ni trazabilidad.** Faltan `Stock en CD`, `Últimos movimientos` y `Pendientes de confirmar`, además del detalle histórico posterior a la confirmación.
3. **Arquitectura de información distinta a la especificación.** Faltan grupos Inicio, Maestros, Recepción y control, Control, además de Necesidades, Trazabilidad, Comprobantes y Devoluciones donde corresponden. La sidebar actual usa Catálogo, Red, Inventario, Distribución, Ventas y Auditoría.
4. **Acciones inválidas sin explicación contextual.** Por ejemplo, “Registrar nuevo ingreso” se deshabilita fuera de un CD sin explicar el motivo/acción siguiente. El POS tampoco anticipa disponibilidad por línea.
5. **POS disponible bajo ámbito CD.** Con Centro de Distribución activo, Ventas permite abrir catálogo, agregar artículos y elegir cobro, aunque el contexto indica que POS y devoluciones corresponden a locales. Debe bloquear el flujo y ofrecer cambiar a un local. Dueños: `frontend/src/modules/ventas_caja/pages/VentasCajaPage.jsx` y `frontend/src/shared/components/AppShell.jsx`.
6. **Breadcrumbs sin semántica de teclado.** Varios flujos usan `<span onClick>` para navegar, sin foco, Enter/Espacio ni semántica. Archivos confirmados: `RecepcionPage.jsx`, `CrearOrdenPage.jsx`, `EmpaquetadoPage.jsx`, `OrdenDetallePage.jsx` y `RemitoDetallePage.jsx`. Deben ser `Link` o botón con el comportamiento accesible correspondiente.
7. **Selector custom de teclado incompleto.** `Select` abre/cierra con flechas, pero no mantiene opción activa ni permite recorrer/confirmar opciones como listbox accesible. Afecta la selección de sede y de remito. Dueño: `frontend/src/shared/components/Select.jsx`.

### Reposición, despacho, recepción y trazabilidad

5. **Necesidades sin filtros operativos ni resumen fijo.** Faltan filtros por local, urgencia, SKU/nombre, categoría y proveedor; también selección consolidada y resumen persistente. Algunos datos aún no están expuestos por la API.
6. **La orden no muestra disponibilidad real de CD.** La escasez aparece recién al crear el bulto; falta read model de disponibilidad por renglón, bloqueo explicativo y prevención antes de confirmar.
7. **Se puede emitir/despachar un remito parcial.** Empaquetado habilita generar remito con algún bulto precintado aunque existan renglones pendientes; el despacho marca la orden como despachada con el primer remito. Debe definirse y aplicar una única política: remito completo único o despacho parcial modelado explícitamente.
8. **No existe trazabilidad central buscable.** Sólo se consulta por `bulto_id`, el detalle suele abrir el primer bulto y la línea de tiempo no incluye todas las claves requeridas: bulto, precinto, remito, orden, SKU, sede, fechas, documento, operador y fecha completa.
9. **Recepción muestra documentos no accionables.** El selector incluye remitos cerrados al filtrar solamente los distintos de `EMITIDO`; debe mostrar y ordenar sólo trabajo operativo (`DESPACHADO` y `RECIBIDO`).

## P2: coherencia visual e interacción

1. **Conteo estático en navegación.** `Alertas: 2` y el badge de alerta no provienen del trabajo pendiente real. Los contadores deben limitarse a pendientes accionables.
2. **Inbox ausente del header.** El header conserva sede, contexto y tema, pero falta inbox priorizada y el operador no está en el header como indica la especificación.
3. **Errores recuperables inconsistentes.** Varios flujos críticos renderizan `err.message` en una caja de peligro sin CTA `Reintentar`; las tablas sí tienen un patrón de reintento. Hay que unificar mensaje seguro, acción y conservación de datos.
4. **Motion no ajustado a la especificación.** Hay transiciones de 240/280 ms y un easing elástico en toasts. El rediseño pide aproximadamente 200 ms, desplazamiento corto y sin easing elástico.
5. **Inspección visual de stock.** La captura desktop muestra una tabla muy extensa sin paginación o límite visible, lo que dificulta recuperar contexto operativo. La vista móvil mantiene los controles alcanzables y el apilado correcto, pero el header ocupa gran parte del primer viewport antes de llegar a las existencias.
6. **Foco de teclado con contraste insuficiente.** En tema claro, el anillo `rgba(20,20,19,.22)` sobre blanco queda por debajo del contraste recomendado para un indicador de foco. Debe usarse un token opaco y de alto contraste. Dueño: `frontend/src/shared/styles/tokens.css`.
7. **Tabla de alertas corta el estado crítico.** En desktop, la píldora de Estado queda truncada sin señal de desplazamiento. La tabla requiere ancho mínimo/affordance de scroll o una jerarquía de columnas por breakpoint. Dueños: `SortableDataTable.jsx`, `components-data.css` y `AlertasPage.jsx`.
8. **Objetivos táctiles pequeños.** Los checkboxes de tablas miden 16 × 16 px; el área interactiva debe llegar al menos a 24–32 px preservando el glifo compacto. Dueño: `frontend/src/shared/styles/components-data.css`.
9. **Header móvil sobredimensionado.** En 390 px, sede, título de ruta, ámbito, alertas y tema se apilan antes del contenido, retrasando la acción operativa. Compactar contexto y mover utilidades secundarias al menú/drawer. Dueños: `AppShell.jsx` y `layout.css`.

## Aspectos ya alineados

- Paleta base y tokens: fondo, superficies, grafito primario, estados semánticos y ámbitos CD/local.
- Modo oscuro, números tabulares, foco `:focus-visible` y respeto de `prefers-reduced-motion`.
- Componentes compartidos de tabla con carga, vacío, error y reintento.
- Overlay compartido en portal, scroll interno, Escape y trampa de foco.
- Wizard de orden, empaquetado de dos columnas, checklist por bulto y cierre con impacto visible.
- Reportes operativos e impresión aislada con encabezado, filtros y apéndice apaisado.

## Orden de implementación recomendado

1. Corregir la transición documental del remito y sus pruebas.
2. Definir contratos de stock documental: ingresos pendientes/confirmados, saldos y movimientos.
3. Construir Inicio/inbox y la nueva navegación sobre esos read models.
4. Completar ficha de producto, matriz e ingreso documental.
5. Cerrar reposición: disponibilidad, reglas de remito parcial, trazabilidad y recuperación de errores.
6. Integrar ventas/caja persistentes y devoluciones con stock, caja e historial.
7. Aplicar el pase final visual: semántica de color, densidad de tablas, timing de motion, responsive y capturas Playwright desktop/móvil.

## Validación pendiente al implementar

- Transición inválida: segunda recepción, cierre sin controles y despacho parcial según la política acordada.
- Ingreso: documento obligatorio, pendiente no vendible y acreditación sólo tras confirmación.
- Desktop, desktop angosto y 320 px con navegación, tabla, wizard y overlays.
- Teclado: foco inicial, Tab/Shift+Tab, Escape y retorno de foco en overlays.
- Happy path completo CD → Local, venta, devolución y trazabilidad.
- Capturas Playwright de los flujos críticos y de los estados loading, vacío, error, disabled y éxito.
- Navegación de teclado automatizada: selector de sede/remito, breadcrumbs, foco visible y overlays.
