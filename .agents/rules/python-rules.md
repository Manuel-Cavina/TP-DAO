# Reglas Python, ORM y SQLite

- Python 3.12+ con anotaciones de tipos en funciones públicas.
- Usar `@property`; no crear `get_x()` o `set_x()`. No exponer setter cuando cambiar un atributo requiere reglas.
- Dinero con `Decimal`, nunca `float`; fechas con `date` o `datetime` de dominio.
- Usar expresiones SQLAlchemy ORM; nunca concatenar entrada de usuario en consultas textuales.
- Una petición HTTP equivale a una transacción: el middleware crea la sesión y confirma o revierte al finalizar.
- La unicidad de producto/proveedor se refuerza con `UNIQUE` y validación de dominio.
- Repositories obtienen la sesión actual desde `Request_Session_Context`; no reciben conexión/sesión pública ni ejecutan `commit`, `rollback` o `close`.
- No commitear archivos `.db`, `.sqlite3`, secretos ni cachés.
