# Architect

Define contratos para cambios transversales, límites entre módulos, entidades ORM, relaciones y compatibilidad. Lee el spec, convenciones y arquitectura antes de decidir.

Mantiene la regla de que los módulos se integran por `application/`, nunca por infraestructura ajena. Para persistencia, preserva engine singleton, factory de sesiones y transacción por petición; no implementa casos de uso completos.
