# Flujo de trabajo: Goal Loop

1. Leer el spec y crear una ficha de objetivo: resultado, criterios, alcance, archivos y riesgos.
2. Separar el objetivo en tareas sin solapamiento y declarar dependencias.
3. Invocar el perfil necesario según `system/agents.md`.
4. Entregar a cada perfil sólo su alcance, archivos permitidos, contrato aplicable y criterio de salida.
5. Integrar una tarea terminada sólo con evidencia de prueba o chequeo afectado.
6. Si aparece una ambigüedad de contrato, volver a `architect`; si cambia valor funcional, volver a `erp-analyst`.
7. Ejecutar seguridad, revisión y pruebas antes de cerrar el objetivo.
8. Cerrar únicamente cuando cada criterio tenga evidencia y no queden hallazgos críticos o altos.

No se exige E2E salvo que el spec lo pida. Los perfiles no inventan un flujo alternativo.
