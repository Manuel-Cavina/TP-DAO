# Especificación de Implementación - Integrante 3: Ventas, Cobros, Caja y Devoluciones

> Auditoría del estado de `main` (al 2026-10-18) y plan de implementación del módulo `ventas_caja`, dividido en commits.

---

## 1. Resumen

Lo que llegó a `main` está bien encaminado (38 de 39 tests pasan y el patrón State es correcto), pero logística todavía mueve stock simulado y los contratos de stock que necesita ventas no existen. El módulo `ventas_caja` está vacío salvo las excepciones. El plan son 11 commits que empiezan por el dominio puro, para avanzar sin esperar al Integrante 1.

**Antes de escribir código:** acordar con el Integrante 1 la firma de `consultar_disponible`, `descontar_por_venta` y `reingresar_por_devolucion`, y el tipo de id de producto y local.

---

## 2. Auditoría de lo pulleado

> **Estado (2026-10-20):** los hallazgos de esta auditoría quedaron resueltos en las PRs #7
> (logística: stock real, ids enteros, bugs de remitos y órdenes, sesión por contexto, rutas sin
> capturar `BusinessError`) y #8 (catálogo, stock y Observer del Integrante 1, retiro de `schema.sql`).
> La tabla se conserva como registro de lo que se encontró.

> **Origen de los datos.** Tres hallazgos los verificó el Integrante 3 directamente en el código: el mock de stock en logística, el validador que devuelve 500 y el mapeo de `Venta_No_Encontrada_Exception`. El resto viene de un agente auditor que corrió los tests y pruebas en un entorno aparte, y no se volvió a ejecutar.

### 2.1 Tests

- Sin entorno virtual no corre nada: faltan `sqlalchemy`, `fastapi` y `plotly`, y el repo no tiene venv ni instrucciones de instalación.
- Con las dependencias de `backend/requirements.txt` instaladas: **38 tests OK y 1 fallido**. Falla `test_application_factory_inicializa_esquema_heredado_y_routers`, que espera `/api/catalogo/categorias`, un endpoint que todavía no existe.
- `python -m unittest` no descubre los 25 tests de logística, porque `tests/logistica/` no tiene `__init__.py`.
- El comando de chequeo del equipo (`unittest discover -s backend/tests`) falla porque el paquete `tests/config` tapa a `src/config`.

### 2.2 Hallazgos (de más a menos grave)

| Severidad | Dónde | Problema | Arreglo sugerido |
|---|---|---|---|
| Alta | `logistica/application/*_service.py`, `logistica_router.py` | Si no reciben un servicio de stock, los services usan `Mock_Stock_Service`, y el router nunca se lo pasa. En la app real **no se reserva, no se pone en tránsito ni se acredita stock**. | Hacer obligatorio `stock_service` y mover el mock a `tests/`. |
| Alta | `logistica/application/stock_service_contract.py` | El contrato tiene 4 métodos. Faltan `consultar_disponible`, `descontar_por_venta` y `reingresar_por_devolucion`, y vive en logística en lugar de `ubicaciones_stock`. | Mover el contrato completo (7 métodos) a `ubicaciones_stock/application/`. |
| Alta | `logistica/infrastructure/models.py`, `schema.sql` | Los ids no coinciden entre módulos: logística usa strings libres (`"CD-CENTRAL"`) y catálogo/stock usan enteros con FK. | Acordar un único tipo de id antes de integrar. |
| Alta | `config/api/exception_handlers.py:32-34` | Un validador pydantic que lanza `ValueError` devuelve 500 en vez de 400, porque `error.errors()` no es serializable. | Usar `jsonable_encoder(error.errors())`. |
| Alta | `config/api/router_registry.py` | Los routers se registran dentro de `try/except: pass`. Si un import se rompe, el endpoint desaparece en silencio y responde 404. `ventas_caja` no está registrado. | Importar en forma explícita y dejar que el error se vea. |
| Media | `remito_repository.py`, `empaquetado_service.py` | Un remito con número duplicado da 500, y un bulto puede pasar a un segundo remito, lo que lo saca del primero. | Validar los dos casos con excepciones tipadas (409). |
| Media | `despacho_service.py`, `recepcion_service.py` | La orden pasa a DESPACHADA o CERRADA con el primer remito, aunque queden bultos sin despachar. | Cerrar la orden solo cuando todos sus bultos estén cubiertos. |
| Media | `estado_bulto.py`, `precinto_repository.py` | Al rechazar un bulto no se guarda que el precinto llegó roto. | Llamar a `Precinto_Repository.actualizar` en la verificación. |
| Media | `logistica_router.py` | Cada ruta captura `BusinessError` y pisa el handler global, así que "no encontrado" a veces da 404 y a veces 400. | Lanzar excepciones tipadas y dejar el mapeo al handler global. |
| Media | los 7 repositorios de logística | Reciben `session` por constructor, lo que `persistence-rules.md` prohíbe. | Usar solo `Request_Session_Context`. |
| Media | `config/database.py`, `logistica/infrastructure/schema.py` | Código muerto: el primero queda tapado por el paquete `config/database/` y el segundo no se usa. | Borrarlos. |
| Media | `application_factory.py`, `schema.sql` | `create_all` corre antes que `schema.sql`, así que un modelo ORM con FK a `productos` o `ubicaciones` rompe el arranque. | Usar columnas sin FK hasta que existan los modelos del Integrante 1. |
| Media | `docs/specs/*.md`, `.agents/system/architecture.md` | La documentación contradice al código: habla de `connection` cuando ya se usa ORM, y la spec del Integrante 1 marca como hechas tareas cuyo código de catálogo no existe. | Actualizar la documentación. |
| Media | `domain/orden_reposicion.py` | Acepta productos duplicados y no valida que el origen sea un CD y el destino un local. | Validar en el constructor. |
| Baja | varios | `bultos_ids=["abc"]` da 500; el historial inicial queda con `bulto_id=0`; `Estado_Bulto` no tiene `@abstractmethod`; `requirements.txt` no incluye `pytest` ni fija versiones. | Ajustes puntuales. |

### 2.3 Lo que está bien hecho

- El patrón State está limpio: `Bulto.estado` no tiene setter y los estados finales rechazan cualquier acción.
- El stock se acredita o pasa a merma solo al cerrar el remito, cuando todos sus bultos están Verificado o Rechazado. Cumple la regla clave de la consigna.
- El historial del bulto solo agrega registros, nunca los modifica.
- Las capas se respetan: el dominio no importa SQLAlchemy ni FastAPI.
- El middleware maneja una sesión por request, con commit si todo sale bien y rollback si falla. Está bien diseñado y tiene tests.
- Hay un test de API de punta a punta con SQLite real.

---

## 3. Qué se hizo hasta ahora

De los 5 módulos, solo logística (Integrante 2) está implementado. Ya existe la infraestructura común: API HTTP, base de datos con ORM y manejo de errores. Catálogo, stock, ventas y reportes siguen sin lógica de negocio.

### 3.1 Visión de negocio

| Proceso de la consigna | Estado |
|---|---|
| P1-P2. Locales, CD, productos, proveedores | Sin implementar (solo hay excepciones y la spec del Integrante 1). |
| P3. Orden de reposición | Hecho, desde las necesidades o en forma manual. |
| P4. Empaquetar con remito y precinto | Hecho: bultos con contenido, precinto con código único y remito. |
| P5. Despacho | Hecho, pero con stock simulado: no mueve stock real. |
| P6. Recepción y verificación de precinto | Hecho: precinto intacto → Verificado, roto → Rechazado. El stock se impacta al cerrar el remito (simulado). |
| P7. Ventas, cobros, comprobantes y devoluciones | Sin implementar. **Es el módulo de este documento.** |
| Reportes | Solo la fábrica de gráficos Plotly. Ningún reporte todavía. |

La trazabilidad inmutable del bulto (V2) ya está resuelta en el dominio. La regla de no acreditar stock sin verificar (V1) está bien en la lógica, pero recién se va a cumplir de verdad cuando exista el `Stock_Service` real.

### 3.2 Visión técnica

| Pieza | Qué es | Dónde |
|---|---|---|
| API | FastAPI, con un router por módulo registrado en un lugar central | `bootstrap/application_factory.py`, `config/api/router_registry.py` |
| Persistencia | SQLAlchemy 2 sobre SQLite. Los modelos ORM van en `infrastructure/models.py` de cada módulo; el dominio es Python puro y se mapea a mano en los repositorios. | `config/database/`, `modules/logistica/infrastructure/` |
| Transacción | Una sesión por request. El middleware hace commit si la respuesta es menor a 400 y rollback en cualquier otro caso. Los services nunca tocan la sesión. | `config/api/database_session_middleware.py`, `config/database/request_session_context.py` |
| Errores | Las excepciones de negocio heredan de `BusinessError`. El handler global mapea por **nombre exacto** de clase: `Entidad_No_Encontrada_Exception` → 404, `Entidad_Duplicada_Exception` → 409, y el resto → 400. | `errors/`, `config/api/exception_handlers.py`, `modules/*/domain/exceptions/` |
| Esquema heredado | `schema.sql` corre en cada arranque, después del `create_all` del ORM. | `config/schema.sql`, `config/database/legacy_schema_initializer.py` |
| Reportes | Fábrica de figuras Plotly serializadas a JSON. | `modules/reportes/infrastructure/plotly_factory.py` |
| Reglas para agentes de IA | Reglas, roles y scripts de chequeo de estructura y convenciones. | `.agents/` |
| Tests | `unittest` con `TestClient` y SQLite temporal. | `backend/tests/` |

---

## 4. Alcance del Integrante 3: `ventas_caja`

Este módulo es dueño del proceso obligatorio P7 de la consigna (ventas con uno o más productos, cobro con medios de pago, comprobante y devoluciones con impacto en stock y caja) y del patrón Strategy.

### 4.1 Piezas a construir

| Pieza | Responsabilidad de negocio |
|---|---|
| `Venta` + `Detalle_Venta` | Una venta en un local, con una o más líneas. El precio se copia del producto al vender (precio histórico). |
| `Estrategia_Pago` + `Pago_Efectivo` / `Pago_Tarjeta` / `Pago_Transferencia` | Strategy: cada medio valida y calcula su cobro, sin `if` por tipo. |
| `Comprobante` | Se emite al confirmar la venta, con numeración correlativa por local. |
| `Devolucion` + `Detalle_Devolucion` | Devolución parcial o total de una venta registrada del mismo local, sin superar lo comprado (acumulado). |
| Caja del local | No es una entidad: se calcula como ventas cobradas menos devoluciones reintegradas. |

### 4.2 Dependencias

| Necesita | Dueño | Estado |
|---|---|---|
| `Stock_Service.consultar_disponible`, `descontar_por_venta`, `reingresar_por_devolucion` | Integrante 1 | No existe en el código, solo en su spec. |
| `Producto` (precio, si está activo) y `Local` | Integrante 1 | No existe en el código. |
| Base de datos, sesión por request, routers | Infraestructura común | Existe (FastAPI + SQLAlchemy). |
| Datos para los reportes 1 y 2 | Los consume el Integrante 4 | `ventas`, `detalles_venta` y `devoluciones` tienen que quedar bien persistidos. |

**Cómo no quedar bloqueado:** ventas define sus propios puertos (`Stock_Venta_Contract`, `Catalogo_Venta_Contract`) en `ventas_caja/application/` y los tests usan fakes en memoria. Cuando el Integrante 1 entregue `Stock_Service`, solo se conecta la implementación real.

---

## 5. Plan de implementación en commits

Son 11 commits en la rama `feature/ventas-caja`, ordenados de adentro hacia afuera: dominio puro, persistencia, casos de uso y API. Cada commit deja los tests en verde.

### 5.0 Antes de empezar (no es un commit)

- [x] `git switch main && git pull`, después `git switch -c feature/ventas-caja`.
- [x] Crear un venv en `backend/` e instalar `requirements.txt` + `pytest`. Hace falta desde el commit 5.
- [ ] Acordar con el Integrante 1 la firma de los 3 métodos de stock y el tipo de id de producto y local. **Propuesta: `int`**, porque las tablas `stocks` y `productos` son del Integrante 1.
- [ ] Acordar con quien maneja `config/` los cambios en `router_registry.py`, `model_registry.py` y `exception_handlers.py` (commits 5, 7 y 9).

### 5.1 Fase 1: dominio puro (sin base de datos)

**Commit 1 — `feat(ventas_caja): agrega puertos de stock y catálogo para ventas`** ✅ hecho
- Qué: `Stock_Venta_Contract` (`consultar_disponible`, `descontar_por_venta`, `reingresar_por_devolucion`) y `Catalogo_Venta_Contract` (`obtener_precio_venta`) en `application/`. Fakes en memoria en `tests/ventas_caja/fakes.py`.
- Por qué: es el puerto hacia el Integrante 1. Permite avanzar sin que catálogo y stock existan.
- Listo cuando: los fakes implementan los contratos y hay tests que lo comprueban.

**Commit 2 — `feat(ventas_caja): agrega dominio de Venta y Detalle_Venta`** ✅ hecho
- Qué: `Detalle_Venta` (producto, cantidad > 0, precio unitario > 0, subtotal) y `Venta` (local, fecha y hora, líneas, total). Sin setters para el total ni para las líneas.
- Reglas: si se agrega dos veces el mismo producto, se suma en la misma línea. El total siempre se calcula. La plata usa `Decimal`.
- Listo cuando: hay tests de línea duplicada, cantidad inválida y total.

**Commit 3 — `feat(ventas_caja): implementa Strategy de medios de pago`** ✅ hecho
- Qué: `Estrategia_Pago` (abstracta, `procesar_pago(monto) -> Resultado_Pago`), `Pago_Efectivo`, `Pago_Tarjeta` y `Pago_Transferencia`.
- Reglas: en efectivo, el monto recibido tiene que ser mayor o igual al total, y se calcula el vuelto. Con tarjeta, 1, 3, 6 o 12 cuotas, con el recargo que defina el equipo. La transferencia exige CBU o alias y código de transacción. Si algo falla, se lanza `Pago_Rechazado_Exception`.
- Listo cuando: hay un test por medio de pago, con el caso feliz y los de error. Ningún `if isinstance` por tipo de pago.

**Commit 4 — `feat(ventas_caja): agrega Comprobante y confirmación de venta`** ✅ hecho
- Qué: `Comprobante` (número, venta, fecha, total cobrado, medio de pago) y `Venta.confirmar(estrategia, numero_comprobante)`: la venta delega el cobro en la estrategia y devuelve el comprobante.
- Regla: una venta confirmada no se puede volver a confirmar ni modificar.
- Listo cuando: hay tests de confirmación con los 3 medios y de doble confirmación.

### 5.2 Fase 2: persistencia y caso de uso de venta

**Commit 5 — `feat(ventas_caja): agrega modelos ORM y repositorio de ventas`** ✅ hecho
- Qué: `infrastructure/models.py` con las tablas `ventas`, `detalles_venta` y `comprobantes`, y `Venta_Repository` (guardar, buscar por id, siguiente número de comprobante por local). Registrar el módulo en `config/database/model_registry.py`.
- Reglas técnicas: la sesión sale solo de `Request_Session_Context` y el repositorio nunca hace commit. Sin FK a `productos` ni a `ubicaciones` por ahora. `UNIQUE` en (local, número de comprobante).
- Listo cuando: un test de persistencia guarda y recupera una venta completa en SQLite en memoria.

**Commit 6 — `feat(ventas_caja): agrega servicio Registrar_Venta_Service`** ✅ hecho
- Qué: el caso de uso arma la venta con los precios del catálogo, valida el stock de **todas** las líneas con `consultar_disponible`, cobra, emite el comprobante y recién entonces descuenta (`descontar_por_venta`) y guarda.
- Regla clave (V3): si una sola línea no tiene stock, se rechaza la venta entera con `Stock_Insuficiente_Exception` y no se descuenta nada.
- Cuidado: nunca capturar y silenciar una excepción dentro del service, porque el middleware commitearía una venta a medias.
- Listo cuando: hay tests con fakes de venta OK, de una línea sin stock y de un pago rechazado. En los casos de error, el fake no registra ningún descuento.

**Commit 7 — `feat(ventas_caja): agrega DTOs, mappers y API de ventas`** ✅ hecho
- Qué: `dto/ventas_dtos.py`, `mappers/venta_mapper.py` y `api/ventas_router.py` con `POST /api/ventas`, `GET /api/ventas/{id}` y `GET /api/ventas/{id}/comprobante`. Registrar el router en `config/api/router_registry.py`.
- Reglas técnicas: las rutas no capturan `BusinessError`. Hay que agregar `Venta_No_Encontrada_Exception: 404` en `exception_handlers.py`, porque hoy devolvería 400.
- Listo cuando: un test de API con `TestClient` y SQLite temporal (copiando el patrón de `test_logistica_api.py`) recibe 201 al vender y 400 si falta stock.

### 5.3 Fase 3: devoluciones y caja

**Commit 8 — `feat(ventas_caja): agrega dominio de Devolucion`** ✅ hecho
- Qué: `Devolucion` y `Detalle_Devolucion`, que apunta a la línea original de la venta.
- Reglas (V5): solo de una venta del mismo local. Lo devuelto en cada línea, sumando todas las devoluciones, no puede superar lo comprado. El producto tiene que estar en la venta. Plazo máximo: 30 días. Se reintegra cantidad × precio unitario de la venta. Si algo no se cumple, `Devolucion_Invalida_Exception`.
- Listo cuando: hay tests de devolución parcial, de dos parciales que se pasan de lo comprado, de plazo vencido y de producto que no estaba en la venta.

**Commit 9 — `feat(ventas_caja): agrega persistencia, servicio y endpoint de devoluciones`** ✅ hecho
- Qué: modelos y repositorio de devoluciones; `Registrar_Devolucion_Service`, que busca la venta (`Venta_No_Encontrada_Exception` si no existe), valida y llama a `reingresar_por_devolucion`; y `POST /api/ventas/{id}/devoluciones`.
- Listo cuando: un test de API devuelve parte de una venta y rechaza una devolución de más con 400.

**Commit 10 — `feat(ventas_caja): agrega consulta de saldo de caja`** ✅ hecho
- Qué: `Caja_Service.calcular_saldo(local_id, desde, hasta)`, que calcula ventas cobradas menos devoluciones reintegradas, y `GET /api/caja/{local_id}?desde=&hasta=`.
- Regla: la caja no se guarda, se calcula. Si las fechas están invertidas, se lanza un error.
- Listo cuando: un test con ventas y devoluciones verifica el saldo exacto.

### 5.4 Fase 4: cierre

**Commit 11 — `test(ventas_caja): agrega prueba de punta a punta del flujo de ventas`** ✅ hecho
- Qué: un test que recorre los pasos 7 y 8 del happy path de `docs/implementacion.md`: venta con los 3 medios de pago, comprobante, caja, devolución parcial y devolución de más.
- Después: `git push -u origin feature/ventas-caja` y abrir un PR a `main`. No commitear directo a `main`.

### 5.5 Notas de implementación

- Los casos de uso quedaron como `Venta_Service` (registrar, obtener, listar), `Devolucion_Service` y `Caja_Service`, en lugar de un `Registrar_Venta_Service` aislado, para no crear abstracciones de un único uso.
- `Stock_Venta_Contract` suma `validar_local(local_id)`: la venta y la caja rechazan un CD o una ubicación inexistente/inactiva (404).
- Mientras no exista el código del Integrante 1, `Stock_Venta_Adapter` y `Catalogo_Venta_Adapter` (en `infrastructure/`) implementan los puertos sobre las tablas `ubicaciones`, `stocks` y `productos` de `schema.sql`, con `table()`/`column()` de SQLAlchemy y sin registrar modelos ajenos.
- El comprobante guarda `total` (sin recargo) y `total_cobrado` (con recargo de cuotas). La caja suma `total_cobrado`; la devolución reintegra cantidad × precio unitario histórico, sin recargo. Es intencional y sigue la consigna: si se devuelve completa una venta con recargo, el recargo queda en la caja.
- Numeración concurrente: la tabla `numeradores_comprobante` guarda el último número por local y se incrementa con un `UPDATE` que toma el lock de escritura de SQLite, así dos ventas simultáneas no repiten número. Una devolución bloquea la fila de la venta antes de leer las devoluciones previas, así dos devoluciones simultáneas no superan lo comprado.
- Un producto sin registro de stock en el local cuenta como disponible 0: la venta falla con `Stock_Insuficiente_Exception` (400), no con 404.
- Los DTOs limitan ids (64 bits), cantidades e importes (`Numeric(12, 2)`), y `cuotas` es `StrictInt`: una entrada fuera de rango da 400 y nunca 500.
- Ya aplicados en `config/`: `Venta_No_Encontrada_Exception → 404`, `jsonable_encoder` en errores de validación y registro explícito de los routers de ventas y caja.

Cuando el Integrante 1 entregue `Stock_Service`, se suma un commit más: `feat(ventas_caja): conecta servicios reales de stock y catálogo`, que reemplaza los fakes por las implementaciones reales en las funciones `get_*_service` del router.
