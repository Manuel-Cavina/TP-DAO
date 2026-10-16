# Arquitectura del ERP

El ERP es un monolito modular. Los módulos dueños son `catalogo`, `ubicaciones_stock`, `logistica`, `ventas_caja` y `reportes`.

Cada módulo mantiene `api/`, `application/`, `domain/`, `infrastructure/`, `dto/` y `mappers/`. Las dependencias permitidas son `api → application → domain`; `infrastructure` depende de `domain` y `config`. Entre módulos sólo se importa `domain` o `application`.

Persistencia transversal:

- `bootstrap/Application_Factory` crea FastAPI y registra componentes globales.
- `Database_Engine_Singleton` conserva un único engine SQLite por aplicación.
- `Session_Factory` crea una sesión ORM por petición; una sesión nunca es singleton.
- `Database_Session_Middleware` inicia, confirma o revierte la transacción HTTP y siempre cierra la sesión.
- `Request_Session_Context` permite que los repositories recuperen la sesión activa.
- Las entidades ORM son la fuente de verdad del esquema; `schema.sql` no es operativo.

Responsabilidades:

- `domain`: entidades ORM, reglas, State, Strategy, Observer y excepciones; no usa sesiones, consultas ni HTTP.
- `application`: services que validan casos de uso y coordinan repositories; no conoce SQLAlchemy, conexiones ni transacciones.
- `infrastructure`: repositories ORM con `select`, `add`, `delete` y `flush`; no contiene reglas de negocio ni hace `commit`, `rollback` o `close`.
- `mappers`: sólo `DTO ↔ entidad`.
- `api`: DTOs, rutas y respuestas HTTP; no instancia entidades ni accede a repositories directamente.
