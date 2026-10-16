# Reglas de código

- Clases y excepciones: `Pascal_Snake_Case`; variables, métodos, archivos y directorios: `snake_case`.
- Preferir nombres de negocio; evitar `Manager`, `Helper` o `Utils` sin responsabilidad concreta.
- Un archivo y una clase tienen una responsabilidad clara; no crear abstracciones de un único uso.
- `api` valida transporte y delega; `application` orquesta; `infrastructure` persiste; `mappers` sólo convierten; DTOs no son entidades.
- `domain` puede declarar metadatos SQLAlchemy ORM, pero no importa infraestructura, sesiones, consultas, HTTP, UI ni framework web.
- No silenciar excepciones. Usar guard clauses y excepciones tipadas; no devolver `None`, `False` o `-1` para expresar reglas fallidas.
- Mantener métodos cortos, type hints públicos y efectos explícitos.
