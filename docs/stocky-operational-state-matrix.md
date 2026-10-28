# Estados operativos Stocky

| Entidad | Estados | Acción que habilita el siguiente estado |
| --- | --- | --- |
| Orden | `PENDIENTE` → `EN_PREPARACION` → `DESPACHADA` → `CERRADA` | Crear bulto, emitir/despachar remito, cerrar recepción |
| Bulto | `PREPARADO` → `PRECINTADO` → `EN_TRANSITO` → `RECIBIDO` → `VERIFICADO` / `RECHAZADO` | Precintar, despachar, recibir, controlar precinto |
| Remito | `EMITIDO` → `DESPACHADO` → `RECIBIDO` → `CERRADO` | Despachar, registrar llegada, verificar/rechazar todos los bultos y cerrar |

## Reglas de control

- Un remito se emite para una orden con bultos válidos; el modo estricto exige todos los bultos aprobados.
- Un cierre acredita solamente las unidades verificadas y registra merma para las rechazadas.
- Un operador sólo puede recibir, verificar y cerrar documentos de su sede asignada.
- Todo cambio relevante genera evidencia consultable en trazabilidad.
