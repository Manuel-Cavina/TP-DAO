# Stocky: rediseño operativo (MVP)

## Decisiones aprobadas

- Modo **Preserve**: se conserva logo Stocky, paleta grafito, tipografía del sistema y el lenguaje del wireframe.
- No hay alcance SEO: es una SPA autenticada. Las rutas se preservan por compatibilidad operativa.
- El sidebar se organiza por trabajo: Inicio, Operaciones, Inventario, Catálogo, Ventas y Control.
- Ediciones y configuraciones usan drawer lateral; una acción irreversible usa modal de confirmación.
- No se simulan movimientos, trazabilidad, ventas ni devoluciones: todo dato operativo proviene de la API.

## Flujo canónico

`SKU → alerta de reposición → orden → bulto → remito → recepción → trazabilidad`

| Etapa | Responsable | Estado / evidencia |
| --- | --- | --- |
| Crear catálogo y red | Administrador | Producto y sede activos |
| Detectar faltante | Administrador | Alerta por sede y mínimo |
| Crear orden | Administrador | Orden `PENDIENTE` |
| Preparar / precintar | Operaciones | Bultos y precintos |
| Aprobar / emitir | Operaciones | Remito `EMITIDO` |
| Despachar | Operaciones | Remito `DESPACHADO` |
| Recibir y controlar | Operador de destino | Bultos verificados o rechazados |
| Cerrar | Operador de destino | Remito y orden cerrados, stock impactado |

## Identificadores visibles

Los identificadores son generados por backend, inmutables y no reutilizables. El ID de base de datos no se usa como etiqueta de trabajo.

| Entidad | Formato |
| --- | --- |
| Producto | `SKU-000001` |
| Orden | `OR-000001` (presentación del ID secuencial existente) |
| Remito interno | `RM-000001` |
| Bulto | `BU-000001` (presentación del ID secuencial existente) |
| Precinto físico | código impreso/escaneado; no se renumera desde la UI |

Un remito fiscal o regulatorio futuro será otro campo documental, no reemplaza `RM-`.

## Compatibilidad de rutas

No se eliminan rutas existentes. Los accesos redundantes se redirigen o quedan como vistas filtradas del mismo flujo:

- `/logistica/kanban` → `/logistica/operaciones`
- `/logistica/wizard` → `/logistica/ordenes/nueva`
- `/catalogo/precios` → `/catalogo/productos`
- Movimientos se muestra dentro de Inventario; `/logistica/trazabilidad` conserva la auditoría detallada.
