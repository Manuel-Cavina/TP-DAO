---
name: goal-loop
description: Orquestar cualquier objetivo de desarrollo del ERP desde un spec o una solicitud concreta. Usar para analizar, diseñar, implementar, revisar y probar cambios mediante agentes especializados por tarea, iterando hasta cumplir criterios verificables sin exigir E2E salvo pedido expreso.
---

# Goal Loop: desarrollo orquestado

Usar esta es la única skill local de desarrollo. Leer `.agents/AGENTS.md`, `system/architecture.md`, `system/agents.md`, `system/workflow.md`, el spec aplicable y las reglas pertinentes antes de delegar.

## 1. Abrir el objetivo

Crear una ficha con: resultado observable, criterios de aceptación, módulos dueños, archivos permitidos, dependencias, riesgos y pruebas requeridas. Si falta una decisión funcional, invocar `erp-analyst`; si falta un contrato o cambia un límite modular, invocar `architect` antes de implementar.

## 2. Descomponer y asignar

Crear tareas pequeñas, sin archivos compartidos entre agentes paralelos. Cada despacho debe incluir objetivo, alcance, archivos permitidos/prohibidos, contrato, criterio de salida y evidencia esperada.

| Condición | Perfil a invocar |
| --- | --- |
| Spec, historia o alcance incompleto | `erp-analyst` |
| Contrato, ORM, entidad o interacción entre módulos | `architect` |
| Un módulo backend | `backend` |
| Un módulo frontend | `frontend` |
| UX o diseño visual | `ui-designer` |
| API, ORM, SQLite, pagos, datos o permisos | `security-auditor` |
| Persistencia o contrato sensible | `reviewer` |
| Cobertura o regresión | `test` |

No pedir a un agente que modifique infraestructura de otro módulo. Para cambios ORM, el agente `database-bootstrap` es el único dueño de `bootstrap/` y `config/`; los agentes de módulo sólo trabajan en su módulo y pruebas espejo.

## 3. Bucle de ejecución

1. Despachar tareas desbloqueadas en paralelo.
2. Recibir evidencia: archivos cambiados, criterios cubiertos, pruebas y bloqueos.
3. Integrar sólo tareas que respeten el alcance y los contratos.
4. Si existe hallazgo, crear una tarea de corrección para el dueño correspondiente.
5. Repetir hasta no tener tareas pendientes ni hallazgos críticos/altos.

## 4. Puerta de cierre

Antes de cerrar, confirmar:

- Cada criterio del spec tiene prueba o chequeo asociado.
- `check_structure.py`, `check_conventions.py` y las pruebas afectadas pasan.
- Seguridad revisó cambios de API, ORM, SQLite, pagos, datos o permisos.
- Reviewer revisó persistencia, contratos o cambios transversales.
- No se modificaron módulos ajenos sin contrato aprobado.

Entregar un resumen con resultado, evidencia, riesgos residuales y tareas no realizadas. No simular la respuesta de perfiles: usar la herramienta de orquestación disponible para invocarlos.
