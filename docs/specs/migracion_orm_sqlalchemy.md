# Especificación: migración ORM y ciclo de vida de la aplicación

> **Estado (2026-10-20):** migración completa. Los cinco módulos persisten con SQLAlchemy ORM, el
> esquema sale solo de `Base.metadata.create_all()` y se retiraron `schema.sql` y
> `legacy_schema_initializer.py`. `legacy_sqlite.py` sigue disponible pero ningún módulo lo usa.

> **Estado:** Fase 1 implementada; migración de módulos pendiente.
> **Alcance:** arquitectura transversal de persistencia, inicialización y API.  
> **Referencia funcional:** `docs/implementacion.md`; las reglas de negocio no cambian.

---

## 1. Objetivo y fuera de alcance

### Objetivo

Reemplazar la persistencia directa con `sqlite3` por SQLAlchemy ORM, manteniendo el monolito modular y las invariantes del ERP. La solución debe:

- Inicializar un único engine SQLite y una única fábrica de sesiones.
- Crear una sesión y una transacción por petición HTTP.
- Mantener services libres de sesiones, SQL, `commit` y `rollback`.
- Mapear entidades ORM a tablas y relaciones; los mappers sólo convierten `DTO ↔ entidad`.
- Dejar a los repositories como único acceso de módulos a persistencia.

### Fuera de alcance

- Cambiar SQLite por otro motor, migraciones versionadas, Unit of Work explícito, proxy transaccional, contenedor de dependencias o Factory abstracta.
- Cambiar reglas de stock, logística, ventas, devoluciones o reportes.
- Implementar código productivo en la fase documental.

---

## 2. Historias de usuario

### US-01: Inicialización consistente

Como responsable de stock, quiero que el backend inicie una única configuración de persistencia para que catálogo, stock, logística y ventas usen el mismo esquema SQLite.

**Criterios de aceptación**

- Dado el arranque de la aplicación, cuando se construye FastAPI, entonces existe un único `Database_Engine_Singleton`.
- Dado el engine inicializado, cuando se abre una conexión SQLite, entonces las claves foráneas están habilitadas.
- Dado el conjunto de entidades ORM, cuando la aplicación inicia, entonces se crean las tablas faltantes desde `Base.metadata`.

**Fuera de alcance:** migraciones de esquema versionadas.

### US-02: Operación atómica por API

Como vendedor, quiero que una operación HTTP guarde todos sus cambios o ninguno para no dejar ventas, comprobantes o stock en estados parciales.

**Criterios de aceptación**

- Dada una petición válida, cuando finaliza con respuesta exitosa, entonces se confirma una única transacción.
- Dada una petición que llama varios repositories, cuando uno falla, entonces se revierten todos sus cambios.
- Dada una excepción de negocio o técnica, cuando la API responde un error, entonces se cierra la sesión asociada a la petición.

**Fuera de alcance:** transacciones distribuidas fuera de SQLite.

### US-03: Persistencia transparente para los services

Como operador logístico, quiero que los services mantengan sólo las reglas del caso de uso para que la persistencia no altere las transiciones de bultos ni el stock.

**Criterios de aceptación**

- Dado un service, cuando llama a un repository, entonces no recibe ni pasa una conexión o sesión.
- Dado un repository, cuando consulta o persiste, entonces usa la sesión activa de la petición.
- Dado un DTO de entrada o salida, cuando cruza el límite de API, entonces un mapper realiza su transformación con la entidad.

**Fuera de alcance:** exponer entidades ORM directamente en HTTP.

---

## 3. Arquitectura y responsabilidades

```text
Frontend HTTP
  → Database_Session_Middleware
    → API / Router
      → Application / Service
        → Infrastructure / Repository
          → SQLAlchemy ORM
            → SQLite
```

| Capa o componente | Responsabilidad | No hace |
| --- | --- | --- |
| `domain/` | Entidades ORM, relaciones, invariantes, State, Strategy, Observer y excepciones. | Sesiones, consultas, HTTP o transacciones. |
| `dto/` | Datos de entrada y salida HTTP. | Reglas o persistencia. |
| `mappers/` | Conversión `DTO ↔ entidad`. | Consultas, filas o sesiones. |
| `application/` | Services que validan casos de uso y coordinan repositories. | Conocer SQLite, ORM, sesiones o commits. |
| `infrastructure/` | Repositories ORM: consulta, agrega, elimina y hace `flush`. | Reglas de negocio o respuestas HTTP. |
| `api/` | Rutas FastAPI, DTOs y respuestas JSON. | Persistencia directa. |
| `config/` | Configuración técnica global de BD y API. | Lógica de negocio. |
| `bootstrap/` | Construcción e inicialización de la aplicación. | Reglas de módulos. |

Las entidades de `domain/` pueden declarar metadatos ORM (`Base`, columnas, claves y relaciones), pero no usan `Session`, `select`, `commit`, `rollback` ni FastAPI.

---

## 4. Configuración y ciclo de vida de BD

```text
backend/src/
├── main.py
├── bootstrap/
│   └── application_factory.py
└── config/
    ├── database/
    │   ├── base.py
    │   ├── database_engine_singleton.py
    │   ├── session_factory.py
    │   ├── request_session_context.py
    │   ├── model_registry.py
    │   ├── legacy_sqlite.py              # puente temporal Fase 1
    │   └── legacy_schema_initializer.py  # puente temporal Fase 1
    └── api/
        ├── database_session_middleware.py
        ├── exception_handlers.py
        └── router_registry.py
```

| Clase | Tipo | Responsabilidad |
| --- | --- | --- |
| `Database_Engine_Singleton` | Singleton | Conservar el único `Engine` de SQLAlchemy y la `Session_Factory`. |
| `Session_Factory` | Factory | Crear una sesión ORM nueva por petición. |
| `Request_Session_Context` | Contexto de petición | Conservar temporalmente la sesión activa para repositories. |
| `Database_Session_Middleware` | Middleware FastAPI | Crear, confirmar/revertir y cerrar la sesión por petición. |
| `Application_Factory` | Factory | Crear FastAPI e inicializar los componentes globales. |

`Application_Factory` realiza, en orden:

1. Obtiene `Database_Engine_Singleton` con la URL SQLite configurada.
2. Carga el registro de módulos que contienen entidades ORM.
3. Ejecuta `Base.metadata.create_all(engine)`.
4. Crea FastAPI.
5. Inyecta `Database_Session_Middleware` con la `Session_Factory`.
6. Registra CORS, handlers globales y routers.

`main.py` sólo expone `app`. Las entidades ORM son la fuente de verdad del
esquema definitivo. Mientras los módulos heredados sigan usando `sqlite3`, la
Fase 1 aplica `schema.sql` sólo como puente de compatibilidad, sobre el mismo
archivo y la misma transacción de request; se elimina al finalizar 2A y 2B.

### Transacción por petición

```text
entra request
  → middleware crea Session A con Session_Factory
  → Request_Session_Context registra Session A
  → router, service y repositories se ejecutan
  → respuesta < 400: commit de Session A
  → error o excepción: rollback de Session A
  → middleware limpia el contexto y cierra Session A
sale response
```

Los services no coordinan sesiones. Dos repositories invocados por el mismo service usan Session A, preservando atomicidad.

---

## 5. Modelo de datos ORM

Las entidades siguientes se convierten en modelos ORM. Los nombres de tabla son parte del contrato; las restricciones del enunciado se mantienen en SQLite y las reglas de negocio permanecen en entidades y services.

| Módulo dueño | Entidades ORM | Tabla o tablas | Relaciones y restricciones mínimas |
| --- | --- | --- | --- |
| `catalogo` | `Categoria`, `Proveedor`, `Producto` | `categorias`, `proveedores`, `productos` | `Producto → Categoria`, `Producto → Proveedor`; `codigo` y `cuit` únicos. |
| `ubicaciones_stock` | `Ubicacion`, `Local`, `Centro_Distribucion`, `Stock`, `Alerta_Stock` | `ubicaciones`, `stocks`, `alertas_stock` | `Stock → Producto`, `Stock → Ubicacion`; único por producto-ubicación; cantidades no negativas. |
| `logistica` | `Orden_Reposicion`, `Detalle_Orden_Reposicion`, `Bulto`, `Detalle_Bulto`, `Precinto`, `Remito`, `Historial_Bulto` | `ordenes_reposicion`, `detalles_orden_reposicion`, `bultos`, `detalles_bulto`, `precintos`, `remitos`, `historial_bultos` | Los detalles son entidades propias; historial sólo inserta; precinto único. |
| `ventas_caja` | `Venta`, `Detalle_Venta`, `Comprobante`, `Devolucion`, `Detalle_Devolucion` | `ventas`, `detalles_venta`, `comprobantes`, `devoluciones`, `detalles_devolucion` | Detalles conservan cantidad y precio histórico; comprobante correlativo por local. |
| `reportes` | No agrega entidades de escritura. | No agrega tablas. | Consulta los modelos dueños en modo sólo lectura. |

### Convenciones de modelado

- Toda entidad ORM hereda de `Base`, declara `__tablename__`, PK, FK, `UNIQUE`, `CHECK` y `relationship` cuando corresponde.
- Una tabla de detalle con atributos propios es una entidad ORM; no se usa una tabla intermedia anónima.
- Las relaciones se nombran desde el negocio, no desde la base de datos.
- El modelo no devuelve DTOs, no consulta y no abre/cierra sesiones.
- Un repository debe materializar las relaciones necesarias antes de que el mapper construya un DTO; el DTO no depende de carga lazy luego de cerrar la sesión.

---

## 6. Contratos de API, servicios y repositories

### API

Cada router se declara en `modules/<modulo>/api/` con el prefijo `/api/<modulo>`. Una ruta:

1. Recibe un DTO Pydantic de request o parámetros tipados.
2. Llama sólo a un service de su módulo.
3. Devuelve un DTO de response, una lista de DTOs o `204` sin cuerpo.
4. No instancia entidades, no consulta repositories y no maneja la transacción.

### Service

Un service:

1. Recibe DTOs o parámetros de negocio.
2. Valida el caso de uso y aplica reglas que coordinan más de una entidad.
3. Usa mappers para crear o devolver entidades/DTOs.
4. Invoca methods públicos de repositories.
5. Lanza excepciones de negocio; nunca devuelve códigos de error.

### Repository

Un repository expone métodos expresados en el lenguaje del módulo, por ejemplo `guardar`, `buscar_por_id`, `buscar_por_codigo`, `listar` o `actualizar`.

- Obtiene la sesión con `Request_Session_Context.obtener_sesion()`.
- Usa SQLAlchemy ORM (`select`, `add`, `delete`, `flush`).
- No recibe `Session` o `connection` en la firma pública.
- No contiene reglas de negocio y no ejecuta `commit`, `rollback` o `close`.

### Flujo de una escritura

```text
POST /api/catalogo/productos
  → Producto_Crear_DTO
  → Producto_Service.crear_producto(dto)
  → Producto_Mapper.a_entidad(dto)
  → Producto_Repository.guardar(producto)
  → ORM agrega producto a Session A y hace flush
  → Producto_Mapper.a_dto(producto)
  → respuesta 201
  → middleware confirma Session A
```

---

## 7. Fases paralelizables, tareas y PRs

### Reglas de coordinación de agentes

- Un agente trabaja una sola fase o subfase y no edita archivos fuera de su alcance.
- Cada subfase tiene un PR y un commit principal con el mensaje indicado; no se mezclan refactors ajenos.
- Fase 1 debe estar integrada antes de iniciar cualquier subfase 2.
- Las subfases 2A, 2B, 2C y 2D pueden correr en paralelo; ninguna modifica `bootstrap/`, `config/` ni el módulo de otro agente.
- Fase 3 empieza sólo cuando las cuatro subfases 2 están integradas.
- Cuando un módulo necesita una entidad de otro, usa la FK/relación acordada, no importa su repository, mapper ni API.

### Fase 0: documentación y contratos

**Propietario:** `erp-analyst` y `architect`.  
**Dependencias:** ninguna.  
**Archivos:** `docs/` solamente.
**Orquestación obligatoria:** `goal-loop` invoca `erp-analyst`, `architect` y `reviewer`.

| Tarea | Resultado verificable |
| --- | --- |
| Crear este spec. | Historias, datos, fases, responsables, PRs y criterios presentes. |
| Actualizar convenciones e implementación. | No queda documentación que asigne transacciones a services o `schema.sql` como fuente operativa. |
| Enlazar specs funcionales afectados. | Catálogo/stock referencia este spec transversal. |

**Commit:** `docs(architecture): specify ORM migration and database lifecycle`

### Fase 1: configuración exclusiva de BD e inicialización

**Propietario:** `database-bootstrap`.  
**Dependencias:** Fase 0 integrada.

**Archivos permitidos:** `backend/requirements.txt`, `backend/src/main.py`, `backend/src/bootstrap/`, `backend/src/config/`, `backend/tests/config/` y documentación global.  
**Archivos prohibidos:** `backend/src/modules/`, `backend/tests/modules/`, `frontend/` y specs funcionales.
**Orquestación obligatoria:** `goal-loop` invoca `architect`, `backend`, `security-auditor`, `reviewer` y `test`.

| Tarea | Resultado verificable |
| --- | --- |
| Agregar SQLAlchemy. | Dependencia declarada y disponible para los módulos. |
| Crear `Base`. | Todas las entidades futuras pueden heredar la misma base declarativa. |
| Crear `Database_Engine_Singleton`. | Un engine por aplicación y claves foráneas habilitadas en SQLite. |
| Crear `Session_Factory`. | Nueva sesión por invocación, sin sesión singleton. |
| Crear `Request_Session_Context`. | Repository puede obtener sólo la sesión de la petición actual. |
| Crear `Database_Session_Middleware`. | Commit en éxito, rollback en error y cierre siempre. |
| Crear `Application_Factory` y registro de modelos. | `main.py` sólo expone `app`; la app inicia esquema, middleware, handlers y routers. |
| Crear handlers globales. | Business errors y persistencia se traducen sin exponer detalles internos. |

**Pruebas obligatorias:** singleton único, dos sesiones distintas para dos requests, commit, rollback, limpieza de contexto y cierre de sesión.  
**Commit / PR:** `feat(database): add ORM bootstrap and request transaction lifecycle`

**Implementación de esta fase:** `bootstrap/`, `config/database/`, `config/api/` y
`tests/config/test_database_lifecycle.py`. El adaptador
`config/database/legacy_sqlite.py` reutiliza la conexión de la sesión activa y
no hace `commit`, `rollback` ni `close` durante HTTP. `legacy_schema_initializer`
aplica el DDL heredado solamente hasta que las fases 2A y 2B registren las
entidades ORM; ningún código nuevo puede usar este puente.

### Fase 2A: Catálogo ORM

**Propietario:** `catalogo-orm`.  
**Dependencias:** Fase 1 integrada. Paralela a 2B, 2C y 2D.  
**Archivos permitidos:** `modules/catalogo/`, `tests/modules/catalogo/` y su documentación funcional.
**Capas:** `domain`, `dto`, `mappers`, `infrastructure`, `application`, `api`.  
**Orquestación obligatoria:** `goal-loop` invoca `backend`, `security-auditor`, `reviewer` y `test`.

| Tarea | Resultado verificable |
| --- | --- |
| Modelar `Categoria`, `Proveedor`, `Producto`. | Tablas, FK y únicos declarados por ORM. |
| Reescribir repositories. | Sin `sqlite3`, cursor, SQL textual ni parámetro `connection`. |
| Simplificar services. | Sin imports de infraestructura de BD; preserva validaciones existentes. |
| Mantener DTOs y mappers. | Sólo DTO-entidad; respuestas HTTP no exponen entidades. |
| Adaptar API y pruebas. | Rutas conservan contrato funcional y handlers globales cubren errores. |

**Commit / PR:** `refactor(catalogo): migrate persistence to SQLAlchemy ORM`

### Fase 2B: Ubicaciones y stock ORM

**Propietario:** `stock-orm`.  
**Dependencias:** Fase 1 integrada. Paralela a 2A, 2C y 2D.  
**Archivos permitidos:** `modules/ubicaciones_stock/`, `tests/modules/ubicaciones_stock/` y su documentación funcional.
**Capas:** `domain`, `dto`, `mappers`, `infrastructure`, `application`, `api`.  
**Orquestación obligatoria:** `goal-loop` invoca `backend`, `security-auditor`, `reviewer` y `test`.

| Tarea | Resultado verificable |
| --- | --- |
| Modelar ubicaciones, stock y alertas. | Único producto-ubicación y checks de cantidades definidos. |
| Reescribir repositories. | Opera sólo con ORM y sesión del contexto. |
| Migrar services de stock. | Conserva los siete contratos de stock sin `connection`. |
| Mantener Observer. | Alerta y reposición se disparan según reglas existentes. |
| Adaptar API y pruebas. | Ingreso exclusivo al CD y stock insuficiente siguen cubiertos. |

**Commit / PR:** `refactor(stock): migrate inventory persistence to SQLAlchemy ORM`

### Fase 2C: Logística ORM

**Propietario:** `logistica-orm`.  
**Dependencias:** Fase 1 integrada. Paralela a 2A, 2B y 2D.  
**Archivos permitidos:** `modules/logistica/`, `tests/modules/logistica/` y su documentación funcional.
**Capas:** `domain`, `dto`, `mappers`, `infrastructure`, `application`, `api`.  
**Orquestación obligatoria:** `goal-loop` invoca `backend`, `security-auditor`, `reviewer` y `test`.

| Tarea | Resultado verificable |
| --- | --- |
| Modelar orden, detalles, bultos, remito, precinto e historial. | Detalles son entidades y precinto es único. |
| Reescribir repositories. | ORM sin SQL textual o sesiones públicas. |
| Migrar services y State. | Secuencia de bulto e historial inmutable se conservan. |
| Adaptar API, DTOs, mappers y pruebas. | Despacho y verificación respetan contratos de stock. |

**Commit / PR:** `refactor(logistica): migrate shipment persistence to SQLAlchemy ORM`

### Fase 2D: Ventas y caja ORM

**Propietario:** `ventas-orm`.  
**Dependencias:** Fase 1 integrada. Paralela a 2A, 2B y 2C.  
**Archivos permitidos:** `modules/ventas_caja/`, `tests/modules/ventas_caja/` y su documentación funcional.
**Capas:** `domain`, `dto`, `mappers`, `infrastructure`, `application`, `api`.  
**Orquestación obligatoria:** `goal-loop` invoca `backend`, `security-auditor`, `reviewer` y `test`.

| Tarea | Resultado verificable |
| --- | --- |
| Modelar venta, detalles, comprobante y devoluciones. | Precio histórico y relaciones declarados. |
| Reescribir repositories. | ORM y sesión del contexto sin control de transacción. |
| Migrar services y Strategy. | Pago y devolución conservan las reglas acordadas. |
| Adaptar API, DTOs, mappers y pruebas. | Venta, comprobante y stock son atómicos en la petición. |

**Commit / PR:** `refactor(ventas): migrate sales persistence to SQLAlchemy ORM`

### Fase 3: integración, seed y reportes

**Propietario:** `integration-orm`.  
**Dependencias:** Fases 2A, 2B, 2C y 2D integradas.  
**Archivos permitidos:** `config/` de seed y registro, `modules/reportes/`, `tests/reportes/` y documentación.
**Orquestación obligatoria:** `goal-loop` invoca `architect`, `backend`, `security-auditor`, `reviewer` y `test`.

| Tarea | Resultado verificable |
| --- | --- |
| Completar registro de modelos. | `create_all()` crea el esquema completo. |
| Crear seed ORM idempotente. | CD, locales, catálogo, stock, remitos, ventas y devolución acordados. |
| Migrar reportes. | Consultas ORM sólo lectura; ningún reporte muta datos. |
| Probar flujos cruzados. | Catálogo-stock, logística-stock y ventas-stock confirman o revierten juntos. |

**Commit / PR:** `feat(integration): add ORM seed and reporting queries`

### Fase 4: calidad y cierre

**Propietarios:** `reviewer`, `security-auditor` y `test`.  
**Dependencias:** Fase 3 integrada.  
**Archivos:** pruebas, documentación y ajustes mínimos hallados por revisión.
**Orquestación obligatoria:** `goal-loop` invoca `security-auditor`, `reviewer` y `test`.

| Tarea | Resultado verificable |
| --- | --- |
| Auditoría de arquitectura. | Ningún service conoce sesiones; ningún repository hace commit/rollback/close. |
| Auditoría de seguridad. | No se filtra SQL; rollback e integridad están probados. |
| Calidad. | `check_structure.py`, `check_conventions.py` y pruebas afectadas pasan. |
| Limpieza. | No quedan imports productivos de `sqlite3`, `connection` ni `schema.sql` operativo. |

**Commit / PR:** `docs(architecture): finalize ORM conventions and quality checks`

---

## 8. Seguridad, errores y criterios de aceptación

- SQLite continúa aplicando PK, FK, `UNIQUE` y `CHECK`; no contiene reglas de negocio en triggers ni SQL.
- Las entradas HTTP se validan con DTOs y las invariantes se validan en entidades/services.
- `Persistencia_Exception` no expone SQL, rutas de base ni detalles internos al cliente.
- Los handlers globales responden: `400` datos inválidos, `404` inexistente, `409` duplicado y `500` persistencia técnica.
- Reportes son sólo lectura y no abren una vía de escritura alternativa.

La migración estará aceptada cuando:

- Exista un único engine por aplicación, nunca una sesión singleton.
- Cada petición tenga una sesión propia y todos sus repositories compartan esa sesión.
- Éxito confirme; error revierta; ambos cierren la sesión.
- Ningún service importe SQLAlchemy, `sqlite3`, `Session`, `Engine`, `commit` o `rollback`.
- Ningún repository reciba sesión por parámetro público ni ejecute `commit`, `rollback` o `close`.
- Las reglas funcionales existentes de stock, trazabilidad, ventas y devoluciones permanezcan vigentes.
