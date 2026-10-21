# Stocky ERP: reportes interactivos y PDF profesionales

Estado: diseño aprobado para implementación. Los dos reportes ya tienen datos y gráficos en backend; el exportador PDF definitivo está planificado en `specs/001-stocky-operational-ux/tasks.md`.

## 1. Principio

La pantalla responde una pregunta y permite explorar. El PDF conserva un **snapshot verificable** para compartir o auditar. No se imprime el dashboard ni se depende de que cada navegador interprete CSS del mismo modo.

## 2. Arquitectura mínima recomendada

```text
Filtros validados
  → servicio de reporte existente
  → DTO inmutable + metadatos del snapshot
  ├→ JSON para pantalla interactiva/Plotly
  └→ generador PDF de servidor
       ├→ Plotly + Kaleido: gráficos PNG/SVG deterministas
       ├→ ReportLab Platypus: composición, tablas y paginado
       └→ pypdf: metadatos y validación estructural
```

Herramientas:

- **ReportLab Platypus**: A4, cabeceras/pies, tablas repetibles y anexos apaisados.
- **Plotly + Kaleido**: reutiliza las figuras existentes y las rasteriza sin depender del navegador.
- **pypdf**: verifica páginas, metadatos y apertura del archivo.
- **Poppler + pdfplumber** en pruebas: render visual y extracción de texto para detectar recortes o contenido perdido.

No se agrega otra biblioteca de gráficos. `window.print()` puede quedar temporalmente como vista previa, pero no cumple el contrato de exportación formal.

## 3. Contrato común del snapshot

Cada exportación debe persistir o poder reconstruir:

- `report_id` y versión de plantilla;
- título y pregunta respondida;
- filtros resueltos con etiquetas, no sólo IDs;
- `generated_at` con zona horaria;
- usuario responsable;
- sede/alcance;
- fecha máxima de los datos o leyenda de frescura;
- totales y filas usados;
- hash o identificador único de exportación;
- indicación “Sin datos” cuando corresponda, nunca gráficos vacíos engañosos.

Nombre: `stocky_R1_existencias_2026-10-19_1435.pdf` y `stocky_R2_mermas_2026-10-19_1435.pdf`.

## 4. Estructura formal común

**Página 1, retrato:** marca Stocky una sola vez; título; pregunta; período/alcance; filtros; emisión; responsable; 4–6 KPIs; hallazgos prioritarios; máximo dos gráficos.

**Páginas siguientes, retrato:** interpretación breve, excepciones y metodología. No se generan párrafos automáticos grandilocuentes; cada afirmación se deriva de un dato visible.

**Anexo, paisaje:** detalle tabular, cabecera repetida, número de página global, identificación de reporte y filtros abreviados. No reduce tipografía por debajo de 8.5 pt ni corta columnas.

Pie: `Stocky · Uso interno · <ID exportación> · Página X de Y`.

## 5. R1 — Estado integral de existencias y valorización

### 5.1 Pregunta

“¿Qué productos requieren reposición, dónde están y cuál es el valor económico del stock disponible?”

### 5.2 Datos existentes

Filtros backend: ubicación, categoría y sólo bajo mínimo. KPIs: artículos, registros, unidades disponibles, en tránsito, existencias, costo valorizado, valor de venta, margen potencial y conteos crítico/advertencia/óptimo.

Detalle: SKU, producto, categoría, ubicación/tipo, disponible, en tránsito, total, mínimo, estado, faltante, costo, precio, valorizaciones y margen. Drill-down por producto con desglose en todas las ubicaciones.

### 5.3 Pantalla interactiva

```text
R1 · Estado de existencias                         Actualizado hace 7 s
¿Qué productos requieren reposición y qué valor representan?
[Ubicación] [Categoría] [Sólo bajo mínimo] [Aplicar] [Limpiar]
[Críticos 18] [Faltante 246 u.] [Costo ARS…] [En tránsito 430 u.]
Hallazgos prioritarios                 Valorización por ubicación
1. SKU… faltan 34 u.                   barras: costo vs venta
2. SKU… faltan 21 u.
Distribución por estado                [Tabla detalle ordenable…]
[Exportar PDF formal]
```

La distribución usa barra apilada o barras horizontales con valores; se evita donut si dificulta comparar. La tabla es la evidencia principal, no un elemento secundario escondido.

### 5.4 PDF R1

- KPIs de decisión: productos críticos, unidades faltantes, disponible/en tránsito y valorización a costo.
- Gráfico 1: barras agrupadas de costo/venta por ubicación, ordenadas por costo.
- Gráfico 2: distribución por estado con conteo y porcentaje explícitos.
- Hallazgos: hasta cinco productos con mayor faltante, indicando ubicación.
- Anexo: columnas `SKU`, `Producto`, `Ubicación`, `Disponible`, `Tránsito`, `Mínimo`, `Faltante`, `Estado`, `Costo unit.`, `Valor costo`.
- Las columnas de venta/margen forman un segundo anexo sólo cuando el alcance las solicita; no se comprimen todas en una sola tabla.

## 6. R2 — Auditoría de mermas y precintos

### 6.1 Pregunta

“¿Dónde, cuándo y por qué se rechazaron bultos, y cuál fue el impacto económico verificable?”

### 6.2 Datos existentes

Filtros backend: fecha inicio, fecha fin y local destino. KPIs: bultos rechazados/evaluados, unidades perdidas, costo, valor de venta, tasa de rechazo y local más afectado.

Detalle: bulto, orden, remito, precinto, integridad, origen/destino, fecha, motivo, unidades y pérdidas. Drill-down forense: productos, línea temporal, dictamen y pérdida por producto.

Limitación actual: la tasa usa el total histórico evaluado por local aunque el numerador puede estar filtrado por fechas. Antes de publicar una tasa de período debe alinearse el denominador con el mismo rango.

### 6.3 Pantalla interactiva

```text
R2 · Mermas y precintos                          Actualizado hace 7 s
¿Dónde y por qué se produjeron pérdidas?
[Desde] [Hasta] [Local destino] [Aplicar] [Limpiar]
[Rechazados 6/184] [Tasa 3,26%] [42 u.] [Costo ARS…]
Incidentes prioritarios               Pérdida por local
BU-45 · Precinto violado · ARS…       barras horizontales
Motivos de rechazo                    [Tabla de evidencia…]
[Exportar PDF formal]
```

### 6.4 PDF R2

- KPIs: rechazados/evaluados, tasa coherente con período, unidades, pérdida a costo y valor de venta.
- Gráfico 1: pérdida a costo por local; las unidades aparecen como etiqueta o gráfico separado, nunca en un eje dual ambiguo.
- Gráfico 2: motivos de rechazo ordenados por frecuencia, con número y porcentaje.
- Hallazgos: hasta cinco incidentes por mayor pérdida, con remito, bulto, local y precinto.
- Anexo: `Fecha`, `Bulto`, `Orden`, `Remito`, `Precinto`, `Destino`, `Motivo`, `Unidades`, `Pérdida costo`, `Pérdida venta`.
- Anexo forense opcional por bulto: producto/cantidad/pérdida y línea temporal. El “dictamen” se rotula como resumen calculado y no como conclusión humana firmada.

## 7. Wireframe de PDF

```text
┌ STOCKY                                      R1 · EXISTENCIAS ┐
│ Pregunta: ¿Qué productos requieren reposición…?             │
│ Filtros: CD Central · Todas las categorías · Bajo mínimo     │
│ Emitido: 19 oct 2026 14:35 ART · Responsable: Martín Gómez   │
├───────────────────────────────────────────────────────────────┤
│ [18 críticos] [246 u. faltantes] [430 u. tránsito] [ARS …]   │
│                                                               │
│ Hallazgos prioritarios          Valorización por ubicación    │
│ 1. …                            [gráfico estático legible]    │
│ 2. …                                                         │
├───────────────────────────────────────────────────────────────┤
│ Fuente y metodología breve                                  │
├ Stocky · Uso interno · EXP-… · Página 1 de 4 ────────────────┤
```

## 8. Flujo de exportación en UI

1. Usuario aplica filtros y ve cantidad de filas/frescura.
2. “Exportar PDF formal” abre modal con reporte, filtros, secciones incluidas y orientación de anexos.
3. Confirmar crea un snapshot; el botón pasa a “Generando…”.
4. El servidor devuelve el archivo sólo después de validar que es legible y no está vacío.
5. El navegador descarga y el toast informa nombre, filtros e ID de exportación.
6. Si falla, conserva filtros y ofrece reintentar; nunca descarga un PDF parcial.

No se expone un editor de plantillas ni opciones cosméticas: no agregan valor al proceso obligatorio.

## 9. Validaciones y pruebas de aceptación

- El PDF refleja exactamente el reporte y los filtros visibles al confirmar, aunque los datos cambien después.
- El usuario, fecha, zona horaria e ID aparecen en todas las exportaciones.
- Un reporte sin filas produce un documento válido con filtros y mensaje “Sin resultados”, sin páginas en blanco.
- 1, 50, 500 y 5.000 filas paginan sin superposición; la generación grande define límite/estrategia de lote antes de producción.
- Valores negativos, cero, nombres largos, caracteres españoles y grandes importes no se cortan.
- Todas las tablas repiten encabezado y mantienen unidades/moneda.
- Gráficos siguen siendo comprensibles en escala de grises mediante etiquetas, patrones o estructura.
- Prueba automática con `pypdf`: archivo abre, páginas > 0, metadatos presentes.
- Prueba con `pdfplumber`: título, filtros, KPIs y primera/última fila esperada son extraíbles.
- Prueba visual: render Poppler a PNG y revisión a 100% de cada plantilla y anexo.
- El exportador no expone datos de otra sede fuera del alcance del usuario.

## 10. Cambios técnicos mínimos posteriores a la aprobación

1. Añadir endpoint de exportación para R1/R2 que reciba filtros validados, no HTML arbitrario.
2. Extender la respuesta con metadatos de snapshot y denominador correcto de R2 por período.
3. Implementar dos plantillas ReportLab compartiendo sólo header, footer, estilos y paginado.
4. Reutilizar las figuras Plotly existentes y renderizarlas con Kaleido.
5. Sustituir el camino formal basado en `window.print()`; puede quedar como “Imprimir vista” no auditable.
6. Agregar las pruebas estructurales, textuales y visuales anteriores.
