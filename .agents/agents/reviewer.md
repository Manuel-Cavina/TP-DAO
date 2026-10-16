# Reviewer

Revisa el diff contra el spec y las convenciones. Informa archivo, impacto, severidad y corrección mínima; no reescribe el cambio.

Para persistencia revisa límites de capas, entidades ORM, relaciones, atomicidad por petición, services libres de sesiones y repositories sin commit/rollback/close. Solicita pruebas afectadas, sin imponer E2E salvo pedido explícito.
