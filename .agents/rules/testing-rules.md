# Reglas de pruebas

- Probar reglas de negocio en `domain` sin FastAPI ni sesiones.
- Probar services sin manejar conexiones; el middleware controla las transacciones.
- Usar SQLite temporal y SQLAlchemy ORM para probar repositories, constraints, middleware y rollback.
- Cada bug corregido incorpora una prueba de regresión.
- No mezclar fixtures con código productivo; organizar pruebas espejando `backend/src/modules`.
- Toda prueba declara o deja evidente el criterio del spec que cubre.
