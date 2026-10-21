# TP Integrador 2026 · Tema 3 — Ventas e Inventario: Centro de Distribución a Locales

ERP orientado a objetos para un comercio con un **Centro de Distribución (CD)** que abastece a sus
**locales**. Cubre catálogo, inventario por ubicación, logística con trazabilidad de bultos, ventas
con distintos medios de pago, devoluciones, caja y reportes.

> **Regla central de la consigna:** nada ingresa a stock vendible sin verificación. La mercadería
> despachada queda *en tránsito* y recién pasa a *disponible* cuando el remito se cierra con el bulto
> verificado; un precinto roto la convierte en merma.

| Documento | Para qué |
|---|---|
| [docs/tema3.pdf](docs/tema3.pdf) | Consigna original. |
| [docs/implementacion.md](docs/implementacion.md) | Procesos, reglas, contratos y división por integrante. |
| [docs/convenciones.md](docs/convenciones.md) | Arquitectura, nombres, errores y persistencia (normativo). |
| [docs/specs/](docs/specs/) | Especificaciones y decisiones de cada módulo. |

---

## Cómo correrlo

Requiere **Python 3.12+**. Todos los comandos se ejecutan desde `backend/`.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    ·    Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt pytest
```

| Qué | Comando (desde `backend/`) |
|---|---|
| Levantar la API | `cd src && uvicorn main:app --reload` |
| Documentación interactiva | abrir <http://127.0.0.1:8000/docs> |
| Cargar datos de demo | `cd src && python -m bootstrap.seed_demo` |
| Correr los tests | `python -m pytest -q tests` |
| Chequear convenciones | `python ../.agents/scripts/check_conventions.py` y `python ../.agents/scripts/check_structure.py` |

- La base es SQLite en `backend/runtime/erp.sqlite3`; se crea sola al arrancar. Para usar otra,
  definir `ERP_DATABASE_URL` (por ejemplo `sqlite:///ruta/otra.sqlite3`).
- El esquema sale de los modelos ORM con `create_all`, que **no modifica tablas existentes**: si
  cambian los modelos, borrar `runtime/erp.sqlite3` y volver a cargar el seed.
- El seed es idempotente: si la base ya tiene un CD, no carga nada.

## Qué carga el seed de demo

1 CD, 3 locales, 3 categorías, 3 proveedores y 10 productos, con 200 unidades de cada uno en el CD.
Un remito completo por local (uno con un bulto de precinto roto → merma), ventas en tres meses
distintos con efectivo, tarjeta y transferencia, una devolución, y una venta que deja la lavandina
del Local Sur en su mínimo para que el **Observer** genere la alerta y la necesidad de reposición.

---

## Arquitectura

Monolito modular en FastAPI + SQLAlchemy ORM. Cada módulo tiene sus capas
`api → application → domain`, más `infrastructure`, `dto` y `mappers`; no hay capas de negocio
globales. **Entre módulos solo se usa `domain/` o `application/` de otro módulo.**

```text
backend/src/
├── bootstrap/          # Application_Factory (composition root) y seed de demo
├── config/             # Engine Singleton, sesión por request, middleware, handlers y routers
├── errors/             # BusinessError y Persistencia_Exception
└── modules/
    ├── catalogo/           # Integrante 1 · Producto, Categoria, Proveedor
    ├── ubicaciones_stock/  # Integrante 1 · CD, Local, Stock + Observer
    ├── logistica/          # Integrante 2 · Orden, Bulto, Precinto, Remito + State
    ├── ventas_caja/        # Integrante 3 · Venta, Comprobante, Devolucion, Caja + Strategy
    └── reportes/           # Integrante 4 · cinco reportes de solo lectura con Plotly
```

- **Una transacción por request:** `Database_Session_Middleware` confirma si la respuesta es < 400 y
  revierte si no. Una venta, su comprobante y el descuento de stock se guardan juntos o no se guarda nada.
- **Errores:** las reglas de negocio lanzan excepciones tipadas (`BusinessError`). El handler global
  decide el código por el nombre: `*_No_Encontrad[ao]_Exception` → 404, `*_Duplicad[ao]_Exception`
  → 409, el resto → 400.
- **Integración sin acoplar módulos:** catálogo crea el stock del producto nuevo a través del puerto
  `Inicializador_Stock_Contract`; logística y ventas usan el `Stock_Service` mediante sus adaptadores;
  `bootstrap` suscribe al stock el observer de reposición de logística.

## Patrones de diseño

| Patrón | Dónde | Qué resuelve |
|---|---|---|
| **State** | `logistica/domain/estado_bulto.py` | Cada estado del bulto (Preparado → Precintado → En tránsito → Recibido → Verificado/Rechazado) decide qué acciones admite; no se puede retroceder ni saltear pasos. |
| **Strategy** | `ventas_caja/domain/pago_*.py` | Efectivo (vuelto), tarjeta (1/3/6/12 cuotas con recargo) y transferencia (CBU o alias) son intercambiables sin `if` por tipo de pago. |
| **Observer** | `ubicaciones_stock/domain/stock.py` | Cuando el disponible queda en o bajo el mínimo, el stock avisa: se guarda una alerta y, si es un local, se pide reposición al CD. |

## API

| Recurso | Endpoints principales |
|---|---|
| Catálogo | `/api/catalogo/categorias`, `/proveedores`, `/productos` (alta, modificación, baja lógica) |
| Ubicaciones | `/api/ubicaciones` · `POST /locales` · `POST /centros-distribucion` |
| Stock | `/api/stock` · `POST /ingresos` (solo al CD) · `/alertas` · `PUT /{producto}/{ubicacion}/nivel-minimo` |
| Logística | `/api/logistica/necesidades` · `/ordenes` · `/ordenes/consolidar` · `/ordenes/{id}/bultos` · `/precintos` · `/bultos/{id}/precintar` · `/remitos` · `/remitos/{n}/despachar` · `/recibir` · `/cerrar` · `/bultos/{id}/verificar` · `/bultos/{id}/trazabilidad` |
| Ventas | `POST /api/ventas` · `/api/ventas/{id}/comprobante` · `/api/ventas/{id}/devoluciones` |
| Caja | `GET /api/caja/{local_id}?desde&hasta` |
| Reportes | `/api/reportes/ventas` · `/productos-mas-vendidos` · `/existencias` · `/mermas` · `/tiempos-transito` |

## Reportes

Los cinco cruzan varias entidades, agrupan y calculan; devuelven filas, totales y un gráfico Plotly
serializado para que el frontend lo dibuje.

1. **Ventas e ingresos** por período, local y medio de pago: bruto, devoluciones y neto.
2. **Productos más vendidos** con margen estimado en $ y %, marcando los que dan pérdida.
3. **Existencias** por ubicación: disponible, en tránsito, faltante contra el mínimo y valorización.
4. **Bultos rechazados y mermas** por rotura de precinto: unidades y valor perdido por local.
5. **Tiempo de tránsito** CD → local (promedio, mínimo y máximo), calculado desde el historial inmutable del bulto.

## Reglas de negocio verificadas por tests

- **V1:** el stock del local recién es vendible al cerrar el remito con el bulto verificado; el rechazado es merma.
- **V2:** el historial del bulto solo se agrega, nunca se modifica.
- **V3:** no se vende más que el stock disponible y verificado; si una línea no alcanza, se rechaza la venta completa.
- **V4:** no se repiten el código de producto, el CUIT del proveedor ni el número de remito o precinto.
- **V5:** solo se devuelve de una venta registrada del mismo local, dentro de 30 días y sin superar lo comprado.

El recorrido completo de la consigna (sección 6 de `implementacion.md`) está automatizado en
`backend/tests/integracion/test_happy_path_api.py`.
