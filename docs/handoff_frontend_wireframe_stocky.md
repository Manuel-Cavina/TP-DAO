# Handoff — Frontend Stocky fiel al wireframe

## Objetivo inalterable

Completar el spec activo del frontend: reproducir fielmente el wireframe en **todas** sus pantallas y flujos, con datos y APIs reales del backend, corrigiendo fallos de arranque, CORS y conectividad.

No declarar terminado porque compile o porque una pantalla aislada se vea bien. La condición de cierre es que cada pantalla y flujo del wireframe sea navegable, coherente visualmente, funcional y respaldado por el backend real.

## Fuente de verdad y orden de precedencia

1. [`prototipo_wireframes_stocky.html`](prototipo_wireframes_stocky.html): composición visual aprobada y pantallas de referencia.
2. [`wireframes_stocky_aprobacion.md`](wireframes_stocky_aprobacion.md): IA, navegación, roles y criterios visuales.
3. [`arquitectura_ui_operativa_detallada.md`](arquitectura_ui_operativa_detallada.md): detalle de entidades, Kanban, transiciones y trazabilidad.
4. `specs/001-stocky-operational-ux/spec.md`: requisitos funcionales y criterios de éxito.
5. `specs/001-stocky-operational-ux/tasks.md`: tareas y comprobaciones pendientes.

Ante diferencias, prevalece el documento detallado más reciente, tal como indica el documento de aprobación.

## Wireframe y rutas objetivo

| Wireframe | Ruta productiva | Implementación principal |
|---|---|---|
| Acceso | `/login` | `frontend/src/app/auth/LoginPage.jsx` |
| Inicio | `/dashboard` | `frontend/src/app/dashboard/AdminDashboardPage.jsx` |
| Maestros | `/catalogo/*`, `/stock/ubicaciones` | `frontend/src/modules/catalogo` y `ubicaciones_stock` |
| Reposición / wizard | `/logistica/ordenes/nueva` | `CrearOrdenPage.jsx` |
| Distribución / Kanban | `/logistica/operaciones` | `OperacionesPage.jsx`, `OrdenKanban.jsx`, `RemitoKanban.jsx` |
| Detalle de orden | `/logistica/ordenes/:id` | `OrdenDetallePage.jsx` |
| Empaquetado | `/logistica/empaquetado` | `EmpaquetadoPage.jsx` |
| Detalle de remito | `/logistica/remitos/:numero` | `RemitoDetallePage.jsx` |
| Recepción / precintos | `/logistica/recepcion` | `RecepcionPage.jsx` |
| Detalle de bulto | `/logistica/bultos/:id` | `BultoDetallePage.jsx` |
| Trazabilidad | `/logistica/trazabilidad` | `TrazabilidadPage.jsx` |
| Operador móvil | `/operador` | `OperatorDashboardPage.jsx` |
| Ventas y caja | `/ventas` | `frontend/src/modules/ventas_caja` |
| Reportes | `/reportes/stock`, `/reportes/mermas`, `/reportes/imprimible` | `frontend/src/modules/reportes` |

`KanbanPage.jsx` contiene una implementación antigua con datos locales y no debe reactivarse. La ruta `/logistica/kanban` debe mantener `OperacionesPage`, que consume API real.

## Arquitectura de navegación aprobada

La sidebar administrativa debe expresar exactamente esta IA:

```text
Inicio
Maestros
  Productos · Categorías · Proveedores · Centros y locales
Inventario
  Stock por ubicación · Ingresos al CD · Alertas de reposición · Movimientos
Distribución
  Necesidades · Órdenes · Empaquetado · Remitos y despacho
Recepción
  Pendientes de recibir · Historial de recepciones
Ventas y caja
  Punto de venta · Comprobantes y caja · Devoluciones
Control
  Trazabilidad · Reportes · Exportaciones PDF
```

El operador no usa la sidebar administrativa: sólo `Trabajo`, `Historial` y `Cuenta` (más escaneo cuando el flujo lo requiera).

Archivos responsables:

- `frontend/src/shared/components/AppShell.jsx`
- `frontend/src/app/layout/AppLayout.jsx`
- `frontend/src/app/router.jsx`
- `frontend/src/shared/styles/layout.css`
- `frontend/src/shared/styles/wireframe-tokens.css`

No reintroducir selector global de sede que cambie silenciosamente el significado de una operación. Origen/destino se eligen dentro de cada flujo. Una sede de lectura sólo puede usarse si se nombra como tal.

## Reglas no negociables

### Datos y backend

- No crear arrays demo, contadores mínimos, valores fallback ni estados de éxito ficticios para cubrir una API caída.
- Cualquier error de API debe tener estado de carga/error/vacío recuperable, conservando la diferencia entre “sin datos” y “no se pudo consultar”.
- Reusar servicios existentes; no duplicar lógica de dominio en React.
- No usar mocks normales en Dashboard, Reportes, Kanban, Trazabilidad, Recepción ni Venta.
- Antes de modificar un contrato HTTP, inspeccionar router, DTO y servicio backend correspondiente.

### Diseño

- Sidebar grafito `#111214`, canvas claro `#F4F4F2`, superficies blancas sobrias y bordes discretos.
- Inicio es el único panel de control administrativo: alertas, trabajo pendiente, carga de ciclo y movimientos recientes.
- Kanban: una entidad por tablero; soltar una tarjeta abre confirmación/panel, nunca persiste directamente.
- Detalles de Orden, Remito y Bulto deben mantener resumen, contenido, trazabilidad, documentos/impacto y relaciones navegables.
- La búsqueda global debe enviar a trazabilidad y consultar orden, remito, bulto, precinto o SKU reales.
- No apilar un segundo shell dentro de `AppShell` (`.screen`, `.workspace`) en páginas productivas.

### Seguridad y persistencia

- No borrar `backend/runtime/erp.sqlite3` para arreglar un esquema. La base puede contener datos de trabajo.
- La compatibilidad actual se resuelve con `backend/src/config/database/schema_migrations.py`: migración aditiva e idempotente para `remitos.orden_id`, invocada por `Application_Factory`.
- CORS permitido para `localhost:5173` está configurado en `backend/src/bootstrap/application_factory.py`. Un `ERR_CONNECTION_REFUSED` normalmente indica backend apagado, no CORS.

## Estado ya comprobado

### Implementado y probado

- `/dashboard` es el destino administrativo inicial y consume APIs reales.
- Se eliminaron datos operativos falsos de `useAdminDashboard` y `reportesService`; `reportesMockData.js` fue eliminado.
- Dashboard usa `/api/stock/alertas`, `/api/stock`, `/api/logistica/necesidades`, `/api/logistica/ordenes`, `/api/logistica/remitos`, `/api/ubicaciones` y `/api/catalogo/productos`.
- La migración de SQLite recupera `remitos.orden_id` desde `bultos` sin reset de datos.
- Remitos, Dashboard y Trazabilidad fueron verificados con respuestas reales `200` después de aplicar la migración.
- Trazabilidad no selecciona automáticamente un resultado ambiguo; primero muestra resultados para que la persona decida.
- Reportes consume endpoints existentes `/api/reportes/existencias` y `/api/reportes/mermas`, no los endpoints obsoletos `r1-stock-valorizacion`/`r2-mermas-precinto`.
- La sidebar fue migrada a Inicio, Maestros, Inventario, Distribución, Recepción, Ventas y caja, Control.
- Recepción quedó separada de Distribución en navegación y breadcrumb.

### Evidencia local útil

- `frontend/.playwright-cli/dashboard-real-after-migration.png`
- `frontend/.playwright-cli/trazabilidad-real-after-migration.png`
- `frontend/.playwright-cli/reportes-real-after-contract.png`
- `frontend/.playwright-cli/mobile-dashboard.png`
- `frontend/.playwright-cli/mobile-operador.png`
- `.playwright-cli/visual-audit/assessment-dashboard.png`
- `.playwright-cli/visual-audit/assessment-reportes.png`
- `.playwright-cli/visual-audit/assessment-trazabilidad.png`

### Pendiente antes de cierre

1. Comparar visualmente cada ruta de la tabla anterior contra su sección de wireframe, desktop y móvil cuando aplique.
2. Revisar detalles de orden/remito/bulto y el wizard completo con datos reales; no hay evidencia integral de todos los pasos todavía.
3. Verificar que Reportes, exportación PDF y drill-down muestren sólo campos soportados por backend y no presenten valores inferidos como hechos.
4. Resolver el warning de bundle de Vite (>500 kB) si afecta rendimiento real; preferir carga diferida de reportes/Plotly antes que subir el umbral.
5. Completar T076–T089 del spec: foco visible, navegación por teclado, reduced motion, restauración de foco, errores/bordes/CSP/audit trail y recorrido de aceptación total.
6. Ejecutar la auditoría y crítica final de Impeccable después de los cambios finales, no antes.

## Procedimiento de trabajo por pantalla

1. Abrir el wireframe equivalente y anotar: estructura, jerarquía, sidebar, topbar, acciones, estados y relaciones.
2. Abrir la ruta productiva autenticada y obtener screenshot/snapshot.
3. Inspeccionar las requests: toda fuente operativa debe ser API real, sin fallback local.
4. Corregir composición/estilos y preservar el contrato de servicios.
5. Ejecutar la acción principal del flujo y la alternativa/cancelación.
6. Repetir con carga, vacío, error y datos reales cuando el backend lo soporte.
7. Probar a 1440×1000 y 390×844. El operador se prueba en móvil.
8. Guardar captura con nombre descriptivo bajo `frontend/.playwright-cli/` o `.playwright-cli/visual-audit/`.

## Comandos de verificación

### Backend

Desde la raíz:

```powershell
python -m pytest backend/tests/configuracion/test_database_lifecycle.py -q
```

Comprobar la migración sin destruir datos:

```powershell
Set-Location backend/src
@'
from pathlib import Path
import sqlite3
from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton

Application_Factory.crear_aplicacion()
database = Path(Database_Engine_Singleton._database_url.removeprefix("sqlite:///"))
with sqlite3.connect(database) as connection:
    columns = [row[1] for row in connection.execute("PRAGMA table_info(remitos)")]
    counts = connection.execute("SELECT COUNT(*), COUNT(orden_id) FROM remitos").fetchone()
print(database, "orden_id" in columns, counts)
'@ | python -
```

### Frontend

```powershell
Set-Location frontend
npm run check
npm run build
git diff --check
```

El build puede advertir por chunk mayor a 500 kB; no tratar la advertencia como aprobación de rendimiento.

### Navegador (Playwright CLI)

```powershell
Set-Location frontend
playwright-cli -s=verification open http://localhost:5173/#/login
playwright-cli -s=verification --raw snapshot
playwright-cli -s=verification --raw fill '#loginEmail' 'admin@stocky.local'
playwright-cli -s=verification --raw fill '#loginPassword' 'stocky-demo'
playwright-cli -s=verification --raw press Enter
playwright-cli -s=verification --raw goto http://localhost:5173/#/dashboard
playwright-cli -s=verification --raw requests
playwright-cli -s=verification --raw console
```

Para capturas:

```powershell
playwright-cli -s=verification --raw resize 1440 1000
playwright-cli -s=verification --raw screenshot --filename=.playwright-cli/nombre-descriptivo.png
playwright-cli -s=verification --raw resize 390 844
playwright-cli -s=verification --raw screenshot --filename=.playwright-cli/mobile-nombre-descriptivo.png
```

Interpretar consola con cuidado: el historial de una sesión conserva errores viejos. Para concluir que una ruta quedó limpia, abrir sesión nueva o revisar sólo las requests posteriores a la última navegación.

## Auditoría final obligatoria

La petición original exige `$impeccable audit` y `$impeccable critique` al final.

1. Leer `C:/Users/cayet/.agents/skills/impeccable/SKILL.md` y sus referencias aplicables.
2. Ejecutar el detector:

```powershell
& C:/Users/cayet/.agents/skills/impeccable/scripts/impeccable.cmd detect --json frontend
```

3. Ejecutar audit técnico: accesibilidad, rendimiento, theming, responsive e integridad de implementación.
4. Ejecutar critique con dos evaluaciones independientes cuando haya subagentes disponibles:
   - A: revisión de diseño/heurísticas sin ver detector.
   - B: detector y evidencia de navegador sin emitir juicio de UX.
5. Corregir P0/P1 resultantes y volver a verificar. No usar el audit previo como certificado de cierre.

## Criterios para marcar objetivo completo

Sólo marcar el goal como `complete` si existe evidencia actual de todos estos puntos:

- Todas las rutas de la tabla funcionan con backend real.
- Todas las pantallas reflejan el wireframe aprobado, no sólo el shell.
- Los flujos Orden → Empaquetado → Remito → Despacho → Recepción → Cierre se ejecutan y conservan relaciones/evidencia.
- Los flujos de catálogo, stock, ventas y reportes también funcionan con datos reales.
- No quedan mock/fallbacks operativos ni errores CORS/conexión en una sesión nueva funcional.
- Desktop administrativo y móvil de operador fueron comprobados visualmente.
- `npm run check`, `npm run build`, pruebas backend pertinentes y `git diff --check` no muestran errores atribuibles al trabajo.
- Audit y critique de Impeccable finales no contienen P0/P1 pendientes.

## Precauciones de worktree

El worktree ya contiene modificaciones de otros módulos y cambios preexistentes. No usar `git reset --hard`, `git checkout --` ni borrar archivos para “limpiar”. Revisar el diff de cada archivo antes de editar y preservar cambios que no pertenezcan al objetivo.
