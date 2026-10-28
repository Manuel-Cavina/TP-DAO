# Patrones de interfaz Stocky

## Listas

Todas las listas combinan título, una acción primaria, barra de filtros, tabla/lista y estado vacío o error con recuperación. Los números se alinean a la derecha y las acciones de fila no compiten con la acción primaria.

## Filtros

- Búsqueda como primer control.
- Sede, estado y filtros de dominio en la misma barra.
- `SegmentedControl` sólo para dos o tres alternativas.
- `SearchableSelect` para productos, proveedores y sedes extensas.

## Superficies

- Drawers: crear, editar, revisar cambios masivos y completar trabajo contextual.
- Modales: confirmación irreversible.
- Botón primario: acción siguiente; borde compacto y brillo táctil sólo al interactuar.
- Los estados usan color semántico, nunca color decorativo.
