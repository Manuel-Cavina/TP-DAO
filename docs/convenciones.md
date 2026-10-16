# 🛠️ Convenciones de Desarrollo, Clean Code y Reglas para Agentes (VS Code)

> **PROYECTO:** TP Integrador 2026 - Tema 3: Sistema de Ventas e Inventario (Centro de Distribución a Locales)
>
> **OBJETIVO:** Documento normativo para los 4 integrantes del equipo y los asistentes/agentes de IA en VS Code. Todo código generado o modificado debe cumplir con las reglas de este archivo.
>
> **Documentos relacionados:** [implementacion.md](implementacion.md) (división de trabajo, procesos, excepciones y reportes por módulo) y [migracion_orm_sqlalchemy.md](specs/migracion_orm_sqlalchemy.md) (persistencia, inicialización y transacciones ORM).

---

## 📄 1. Directivas Obligatorias para Agentes de IA

1. **Leer antes de escribir:** Antes de generar código, leer este archivo y la sección del módulo correspondiente en `docs/implementacion.md`.
2. **Simplicidad y Legibilidad Primero:** Código intuitivo, autodocumentado y directo. Sin meta-programación, reflexión ni sobre-diseño.
3. **Modularidad Aguda:** Métodos cortos (máximo 15-20 líneas) con una única responsabilidad (SRP).
4. **No Romper Contratos:** Respetar la firma de los métodos e interfaces acordados entre el equipo.
5. **Cumplimiento de Reglas de Dominio:** Ningún cambio puede eludir las validaciones logísticas o comerciales de la consigna (ver sección 6).
6. **Cero Magia:** Sin librerías o frameworks no acordados por el equipo. La lógica del dominio es Orientada a Objetos pura.
7. **Respetar el módulo:** Trabajar solo dentro del módulo asignado. Si un cambio requiere tocar otro módulo, detenerse y consultarlo.

---

## 🏗️ 2. Arquitectura: Monolito Modular

El sistema es **un solo backend** dividido en **módulos de negocio**. Cada módulo tiene sus propias capas. **No existen capas de negocio globales.**

```text
backend/src/
├── bootstrap/               # Armado e inicialización de FastAPI
├── config/                  # Configuración global de base de datos y API
├── errors/                  # Errores compartidos (BusinessError)
└── modules/
    ├── catalogo/            # Producto, Categoria, Proveedor
    ├── ubicaciones_stock/   # Ubicacion, Local, Centro_Distribucion, Stock + Observer
    ├── logistica/           # Orden_Reposicion, Bulto, Remito, Precinto + State
    ├── ventas_caja/         # Venta, Detalle_Venta, Comprobante, Devolucion + Strategy
    └── reportes/            # Los 4 reportes no triviales
frontend/src/
├── shared/                  # Componentes, cliente HTTP y estilos reutilizables
└── modules/                 # Una carpeta por módulo del backend
```

### Inicialización transversal

```text
backend/src/
├── main.py                              # Sólo expone app ASGI
├── bootstrap/
│   └── application_factory.py           # Construye FastAPI y sus componentes globales
└── config/
    ├── database/
    │   ├── base.py                       # Base declarativa ORM
    │   ├── database_engine_singleton.py  # Engine único de SQLite
    │   ├── session_factory.py            # Sesión nueva por petición
    │   ├── request_session_context.py    # Sesión activa de la petición
    │   └── model_registry.py             # Carga de entidades ORM antes de create_all
    └── api/
        ├── database_session_middleware.py # Ciclo de transacción HTTP
        ├── exception_handlers.py          # Excepciones a HTTP
        └── router_registry.py             # Registro de routers modulares
```

### Capas dentro de cada módulo

| Capa | Responsabilidad | Puede depender de |
|---|---|---|
| `domain/` | Entidades, patrones (State/Strategy/Observer) y excepciones del módulo. Declara el mapeo ORM, pero no usa sesiones, consultas ni transacciones. | Solo `domain/` (propio o de otro módulo), `errors/` y la base declarativa ORM. |
| `application/` | Casos de uso (services). Orquesta dominio + repositorios. | `domain/`, `dto/`, `mappers/`, `infrastructure/` |
| `dto/` | Objetos planos de datos para entrada/salida de la API. Sin lógica. | Nada |
| `mappers/` | Conversión `entidad ↔ DTO`. | `domain/`, `dto/` |
| `infrastructure/` | Repositorios ORM: consulta, agrega, elimina y hace `flush` sobre entidades. | `domain/`, `config/` |
| `api/` | Punto de entrada HTTP del módulo. Recibe DTOs, llama a `application/` y traduce excepciones a respuestas. | `application/`, `dto/` |

### Regla de dependencias

- Las dependencias apuntan **hacia el dominio**: `api → application → domain`. El dominio nunca importa de las capas externas.
- **Entre módulos:** un módulo puede usar el `domain/` o el `application/` de otro módulo (ej. `ubicaciones_stock` usa `Producto` de `catalogo`). **Nunca** el `infrastructure/`, `api/` ni `mappers/` de otro módulo.
- El frontend se comunica con el backend **solo** a través de la API (cliente HTTP en `frontend/src/shared/`).

---

## 🔤 3. Convenciones de Nombres y Estilo

| Elemento | Convención | Ejemplos |
|---|---|---|
| Clases y Excepciones | `Pascal_Snake_Case` (cada palabra en mayúscula, separadas por `_`) | `Orden_Reposicion`, `Estado_Verificado`, `Stock_Insuficiente_Exception` |
| Variables, Atributos y Parámetros | `snake_case` | `cantidad_disponible`, `precio_unitario`, `nivel_minimo_existencia` |
| Atributos internos | `_snake_case` (prefijo `_`) | `self._cantidad_disponible` |
| Métodos y Funciones | `snake_case`, verbo de acción | `verificar_precinto()`, `descontar_stock()`, `procesar_pago()` |
| Constantes | `UPPER_SNAKE_CASE` | `DATABASE_PATH` |
| Archivos y Directorios | `snake_case` | `estado_bulto.py`, `venta_service.py`, `stock_repository.py` |

> ⚠️ `docs/implementacion.md` usa otro formato para algunos nombres. En el código se escriben **siempre** según esta tabla:
> - Clases en `PascalCase` → `Pascal_Snake_Case`: `StockInsuficienteException` → `Stock_Insuficiente_Exception`.
> - Atributos en `camelCase` → `snake_case`: `cantidadDisponible` → `cantidad_disponible`.
>
> **Excepción:** `BusinessError` (`backend/src/errors/business_error.py`) ya existe con ese nombre y se mantiene así hasta que el equipo decida renombrarla.

### Reglas de estilo Python

- **Getters/Setters con `@property`**, no con métodos `get_x()` / `set_x()`:

  ```python
  class Producto:
      def __init__(self, codigo: str, precio: float):
          self._codigo = codigo
          self._precio = precio

      @property
      def precio(self) -> float:
          return self._precio

      @precio.setter
      def precio(self, value: float) -> None:
          if value <= 0:
              raise Datos_Invalidos_Exception("El precio debe ser mayor a cero.")
          self._precio = value
  ```

- **Sin setter cuando el cambio tiene reglas:** si un atributo solo puede cambiar mediante una operación de negocio, no se le define setter. Ejemplo: `Bulto.estado` cambia **solo** a través de sus transiciones, y `Stock.cantidad_disponible` **solo** con `descontar_stock()` / `incrementar_disponible()`.
- **Type hints** obligatorios en firmas públicas (parámetros y retorno).
- **Clases abstractas e interfaces** con `abc.ABC` y `@abstractmethod`.

---

## 🚨 4. Manejo de Errores

- Cada módulo define sus excepciones en `modules/<modulo>/domain/exceptions/` (los nombres están listados por módulo en `docs/implementacion.md`).
- Toda excepción de **regla de negocio** hereda de `BusinessError` (`backend/src/errors/business_error.py`):

  ```python
  from errors.business_error import BusinessError


  class Stock_Insuficiente_Exception(BusinessError):
      pass
  ```

- Los errores **técnicos** (ej. `Persistencia_Exception` por fallas de SQLite) **NO** heredan de `BusinessError`: no son violaciones de reglas, son fallas de infraestructura.
- **Prohibido** devolver códigos de error (`None`, `-1`, `False`) para señalar que una regla falló.
- La capa `api/` captura las excepciones y las traduce a respuestas con un mensaje claro para el usuario.

---

## 🧼 5. Clean Code: Guard Clauses

Validar precondiciones al inicio del método para evitar `if` anidados:

```python
# ❌ MAL (anidamiento y nombres ambiguos)
def descontar(self, c):
    if c != None:
        if c > 0:
            if self.cant_disp >= c:
                self.cant_disp -= c


# ✅ BIEN (guard clauses y nombres claros)
def descontar_stock(self, cantidad: int) -> None:
    if cantidad <= 0:
        raise Datos_Invalidos_Exception("La cantidad debe ser mayor a cero.")
    if self._cantidad_disponible < cantidad:
        raise Stock_Insuficiente_Exception("Stock insuficiente para la venta.")

    self._cantidad_disponible -= cantidad
    if self._cantidad_disponible <= self._nivel_minimo_existencia:
        self.notificar()
```

---

## 🔒 6. Reglas de Negocio e Invariantes Críticas

Ningún programador ni agente de IA puede violar estas reglas del enunciado:

1. **Trazabilidad Inmutable del Bulto (State):**
   - El ciclo de vida **SOLO** avanza en este orden: `Preparado → Precintado → En tránsito → Recibido → Verificado / Rechazado`.
   - Un estado no puede retroceder ni saltearse pasos. Toda acción inválida lanza `Transicion_Estado_Invalida_Exception`.
2. **Ingreso a Stock Vendible:**
   - La mercadería de un bulto **NUNCA** suma al stock disponible del local destino hasta que el bulto pase a `Estado_Verificado` (precinto intacto).
   - Si pasa a `Estado_Rechazado` (precinto roto), se registra como merma/pérdida y **NO** habilita venta.
3. **Restricción de Ventas:** Prohibido vender más que el stock disponible y verificado en el local.
4. **Entidades Únicas:** Sin duplicados de `Producto` (por código) ni de `Proveedor` (por CUIT). Se lanza `Entidad_Duplicada_Exception`.
5. **Devoluciones Válidas:** Solo se aceptan si están vinculadas a una venta registrada y no superan la cantidad comprada.

---

## 🧩 7. Patrones de Diseño Obligatorios

Cada patrón vive en el `domain/` del módulo dueño de esa regla:

| Patrón | Módulo | Clases |
|---|---|---|
| **State** | `logistica` | `Estado_Bulto` (base) y los estados concretos. Cada estado valida si la acción está permitida o lanza `Transicion_Estado_Invalida_Exception`. |
| **Strategy** | `ventas_caja` | `Estrategia_Pago` (abstracta) con `Pago_Efectivo`, `Pago_Tarjeta`, `Pago_Transferencia`, asignadas a `Venta.metodo_de_pago`. |
| **Observer** | `ubicaciones_stock` | `Stock` (observable) notifica cuando `cantidad_disponible <= nivel_minimo_existencia`. Observadores: `Gestor_Orden_Reposicion`, `Alerta_Stock_Service`. |

---

## 🌐 8. Capa API y Comunicación HTTP (FastAPI)

- **Framework acordado:** Se utiliza **FastAPI** con servidor ASGI **Uvicorn**.
- **Organización por módulo:**
  - Cada módulo define en `api/` su enrutador mediante `APIRouter(prefix="/api/<modulo>")` o su clase controladora.
  - El punto de entrada global de la aplicación monta cada router modular:
    ```python
    from fastapi import FastAPI
    from modules.catalogo.api import catalogo_router

    app = FastAPI(title="ERP Monolito Modular", version="1.0.0")
    app.include_router(catalogo_router)
    ```
- **Regla estricta de aislamiento:**
  - `fastapi`, `starlette` y `pydantic` solo se importan en `api/` y `dto/`.
  - El `domain/` tiene **PROHIBIDO** importar FastAPI o cualquier framework web (regla verificada por `.agents/scripts/check_conventions.py`).
- **Mapeo de respuestas y excepciones:**
  - Las excepciones de negocio (`BusinessError`) capturadas en `api/` se traducen a respuestas HTTP estandarizadas:
    - `400 Bad Request`: `Datos_Invalidos_Exception`
    - `404 Not Found`: `Entidad_No_Encontrada_Exception`
    - `409 Conflict`: `Entidad_Duplicada_Exception`
    - `500 Internal Server Error`: `Persistencia_Exception`
- **Frontend y CORS:**
  - El frontend interactúa mediante peticiones JSON consumidas vía `fetch()`. Se habilita `CORSMiddleware` en la app FastAPI para permitir el consumo desde el cliente web.

### Construcción e inyección de la aplicación

- `main.py` sólo ejecuta `Application_Factory.crear_aplicacion()` y expone `app` para Uvicorn.
- `Application_Factory` obtiene `Database_Engine_Singleton`, carga el registro de modelos, ejecuta `Base.metadata.create_all()`, crea FastAPI e inyecta middleware, CORS, handlers y routers.
- `Database_Engine_Singleton` es el único objeto global de acceso a la base. Tiene un `Engine` único y una `Session_Factory`; **no** conserva una sesión activa.
- `Session_Factory` crea una sesión nueva por petición. No se crea una Factory abstracta ni una jerarquía adicional.
- `Database_Session_Middleware` se registra desde `Application_Factory` y se ejecuta antes de cualquier router. Crea la sesión, la registra en `Request_Session_Context`, invoca la ruta y luego confirma o revierte la transacción; finalmente limpia el contexto y cierra la sesión.
- Las rutas no inyectan sesiones mediante `Depends`, no crean repositories y no hacen `commit` o `rollback`.

### Forma obligatoria de una ruta

1. Recibe DTO Pydantic de request o parámetros HTTP tipados.
2. Llama al service del módulo dueño.
3. Devuelve DTO Pydantic de response, lista de DTOs o `204` sin cuerpo.
4. Deja que los handlers globales traduzcan excepciones de negocio y persistencia.

La ruta no construye SQL, no usa ORM y no instancia entidades de dominio directamente.

### Convención de contratos HTTP

- Cada router usa el prefijo `/api/<modulo>` y nombres de recurso en plural, por ejemplo `/api/catalogo/productos`.
- `POST` crea un recurso con un DTO de entrada y responde `201` con su DTO de salida.
- `GET /recurso` lista usando parámetros de filtro tipados cuando existan; `GET /recurso/{id_o_codigo}` obtiene un recurso.
- `PUT` o `PATCH` se usa sólo cuando el caso de uso permite modificar el recurso; una acción de negocio se expresa en una ruta explícita, por ejemplo `/productos/{codigo}/precio`.
- `DELETE` aplica baja lógica cuando la regla del módulo lo requiera y responde `204` sin cuerpo.
- Los errores usan el handler global y el formato HTTP estándar de FastAPI; nunca exponen excepciones, SQL, archivos o rutas internas.

---

## 🗄️ 9. Persistencia con SQLite y SQLAlchemy ORM

- **ORM acordado:** SQLAlchemy ORM es el único mecanismo productivo de persistencia. Mapea entidades del dominio a tablas, columnas y relaciones SQLite.
- **Fuente de verdad:** las entidades ORM y `Base.metadata.create_all()`. Mientras
  catálogo y stock conserven repositories `sqlite3`, el bootstrap aplica
  `schema.sql` sólo como puente temporal sobre la misma sesión de request; no se
  acepta DDL ni persistencia nueva por esa vía.
- **Singleton:** `Database_Engine_Singleton` conserva un único engine por aplicación. Nunca existe una sesión singleton.
- **Factory:** `Session_Factory` crea una sesión ORM por petición HTTP.
- **Transacción por petición:** `Database_Session_Middleware` crea la sesión, la registra para repositories, confirma una respuesta exitosa y revierte ante error. Siempre limpia el contexto y cierra la sesión.
- **Services:** no importan ni reciben `Session`, `Engine`, `sqlite3`, `commit` o `rollback`.
- **Repositories:** obtienen la sesión activa desde `Request_Session_Context`, usan ORM y `flush` cuando requieren ID. No hacen `commit`, `rollback` ni `close`.
- **Lógica de negocio:** no se implementa en SQL, triggers, middleware o repositories.

### Flujo obligatorio de comunicación

```text
Frontend HTTP
  → Database_Session_Middleware crea Session A
    → Router recibe DTO y llama al Service
      → Service valida el caso de uso y llama Repository
        → Repository obtiene Session A desde Request_Session_Context
          → SQLAlchemy ORM lee o persiste entidades
  → Middleware confirma Session A si la respuesta es < 400
  → Middleware revierte Session A ante error o excepción
  → Middleware cierra Session A siempre
```

Para una operación compuesta, todos los repositories de la misma petición usan Session A. Por ejemplo, venta, comprobante y descuento de stock se confirman juntos o se revierten juntos.

### Reglas de uso por desarrollador o agente

- Antes de tocar un módulo, leer este documento, `docs/implementacion.md` y el spec transversal.
- Un agente de módulo sólo modifica su carpeta `modules/<modulo>/`, sus pruebas y su documentación funcional; no modifica `bootstrap/` ni `config/`.
- El agente `database-bootstrap` es el único autorizado a modificar la infraestructura global durante la Fase 1 del spec.
- Un repository expone operaciones del negocio (`guardar`, `buscar_por_id`, `listar`, `actualizar`); no expone SQL ni sesiones.
- Un mapper sólo transforma `DTO ↔ entidad`; no consulta ni persiste.
- Si una relación cruza módulos, se respeta el contrato de `application/`; nunca se importa el repository de otro módulo.

---

## 📝 10. Checklist antes de hacer Commit / Push

- [ ] ¿El código se ejecuta sin errores?
- [ ] ¿Los nombres respetan la sección 3 (`Pascal_Snake_Case` para clases, `snake_case` para el resto)?
- [ ] ¿El `domain/` sigue sin imports de SQL, HTTP o UI?
- [ ] ¿Los imports respetan la regla de dependencias (nada importa el `infrastructure/` de otro módulo)?
- [ ] ¿Las excepciones de negocio heredan de `BusinessError` y están en `domain/exceptions/` del módulo?
- [ ] ¿Se respetan las transiciones del bulto y la regla de no vender sin stock disponible y verificado?
- [ ] ¿Las operaciones compuestas se ejecutan en una única transacción?
- [ ] ¿El service está libre de sesiones, conexiones y control transaccional?
- [ ] ¿El repository no hace `commit`, `rollback` ni `close`?
