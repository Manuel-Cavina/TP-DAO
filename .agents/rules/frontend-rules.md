# Reglas frontend

- Todo código específico vive en `frontend/src/modules/<modulo>`.
- `shared` solo contiene reutilizables; nunca importa desde un módulo.
- Componentes presentan datos; el acceso API se encapsula en servicio/hook del módulo.
- Estados de carga, vacío y error se muestran explícitamente.
- No importar internals de otro módulo: exponer una API pública si hace falta integración.
