# Reglas de persistencia ORM

- SQLAlchemy ORM es el único mecanismo productivo de persistencia; las entidades ORM son la fuente de verdad del esquema.
- `Database_Engine_Singleton` conserva el engine; `Session_Factory` crea una sesión por petición; nunca existe una sesión singleton.
- `Database_Session_Middleware` es el único dueño de `commit`, `rollback` y `close`.
- Services no reciben sesiones o conexiones. Repositories obtienen la sesión activa desde `Request_Session_Context` y usan `flush` cuando necesitan IDs.
- SQLite garantiza PK, FK, `UNIQUE` y `CHECK`; no se trasladan reglas de negocio a SQL, triggers o repositories.
- Reportes sólo leen datos y una operación compuesta conserva atomicidad en una única petición.
