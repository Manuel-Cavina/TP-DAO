# 🛠️ Convenciones de Desarrollo, Clean Code y Reglas para Agentes (VS Code)

> **PROYECTO:** TP Integrador 2026 - Tema 3: Sistema de Ventas e Inventario (Centro de Distribución a Locales)
>
> **OBJETIVO:** Documento normativo para los 4 integrantes del equipo y los asistentes/agentes de IA en VS Code. Todo código generado o modificado debe cumplir con las reglas de este archivo.
>
> **Documentos relacionados:** [implementacion.md](implementacion.md) (división de trabajo, procesos, excepciones y reportes por módulo).

---

## 📄 1. Directivas Obligatorias para Agentes de IA

1. **Leer antes de escribir:** Antes de generar código, leer este archivo y la sección del módulo correspondiente en `docs/implementacion.md`.
2. **Simplicidad y Legibilidad Primero:** Código intuitivo, autodocumentado y directo. Sin meta-programación, reflexión ni sobre-diseño.
3. **Modularidad Aguda:** Métodos cortos (máximo 15-20 líneas) con una única responsabilidad (SRP).
4. **No Romper Contratos:** Respetar la firma de los métodos e interfaces acordados entre el equipo.
5. **Cumplimiento de Reglas de Dominio:** Ningún cambio puede eludir las validaciones logísticas o comerciales de la consigna (ver sección 6).
6. **Cero Magia:** Sin librerías o frameworks no acordados por el equipo. La lógica del dominio es Orientada a Objetos pura.
7. **Respetar el módulo:** Trabajar solo dentro del módulo asignado. Si un cambio requiere tocar otro módulo, detenerse y consultarlo.

---

## 🏗️ 2. Arquitectura: Monolito Modular

El sistema es **un solo backend** dividido en **módulos de negocio**. Cada módulo tiene sus propias capas. **No existen capas de negocio globales.**

```text
backend/src/
├── config/                  # Configuración y conexión SQLite (database.py)
├── errors/                  # Errores compartidos (BusinessError)
└── modules/
    ├── catalogo/            # Producto, Categoria, Proveedor
    ├── ubicaciones_stock/   # Ubicacion, Local, Centro_Distribucion, Stock + Observer
    ├── logistica/           # Orden_Reposicion, Bulto, Remito, Precinto + State
    ├── ventas_caja/         # Venta, Detalle_Venta, Comprobante, Devolucion + Strategy
    └── reportes/            # Los 4 reportes no triviales
frontend/src/
├── shared/                  # Componentes, cliente HTTP y estilos reutilizables
└── modules/                 # Una carpeta por módulo del backend
```

### Capas dentro de cada módulo

| Capa | Responsabilidad | Puede depender de |
|---|---|---|
| `domain/` | Entidades, patrones (State/Strategy/Observer) y excepciones del módulo. **CERO** imports de SQL, HTTP o UI. | Solo `domain/` (propio o de otro módulo) y `errors/` |
| `application/` | Casos de uso (services). Orquesta dominio + repositorios y define la transacción. | `domain/`, `dto/`, `mappers/`, `infrastructure/` |
| `dto/` | Objetos planos de datos para entrada/salida de la API. Sin lógica. | Nada |
| `mappers/` | Conversión `entidad ↔ DTO`. | `domain/`, `dto/` |
| `infrastructure/` | Repositorios SQLite (`INSERT`, `UPDATE`, `SELECT`) y conversión `fila ↔ entidad`. | `domain/`, `config/` |
| `api/` | Punto de entrada HTTP del módulo. Recibe DTOs, llama a `application/` y traduce excepciones a respuestas. | `application/`, `dto/` |

### Regla de dependencias

- Las dependencias apuntan **hacia el dominio**: `api → application → domain`. El dominio nunca importa de las capas externas.
- **Entre módulos:** un módulo puede usar el `domain/` o el `application/` de otro módulo (ej. `ubicaciones_stock` usa `Producto` de `catalogo`). **Nunca** el `infrastructure/`, `api/` ni `mappers/` de otro módulo.
- El frontend se comunica con el backend **solo** a través de la API (cliente HTTP en `frontend/src/shared/`).

---

## 🔤 3. Convenciones de Nombres y Estilo

| Elemento | Convención | Ejemplos |
|---|---|---|
| Clases y Excepciones | `Pascal_Snake_Case` (cada palabra en mayúscula, separadas por `_`) | `Orden_Reposicion`, `Estado_Verificado`, `Stock_Insuficiente_Exception` |
| Variables, Atributos y Parámetros | `snake_case` | `cantidad_disponible`, `precio_unitario`, `nivel_minimo_existencia` |
| Atributos internos | `_snake_case` (prefijo `_`) | `self._cantidad_disponible` |
| Métodos y Funciones | `snake_case`, verbo de acción | `verificar_precinto()`, `descontar_stock()`, `procesar_pago()` |
| Constantes | `UPPER_SNAKE_CASE` | `DATABASE_PATH` |
| Archivos y Directorios | `snake_case` | `estado_bulto.py`, `venta_service.py`, `stock_repository.py` |

> ⚠️ `docs/implementacion.md` usa otro formato para algunos nombres. En el código se escriben **siempre** según esta tabla:
> - Clases en `PascalCase` → `Pascal_Snake_Case`: `StockInsuficienteException` → `Stock_Insuficiente_Exception`.
> - Atributos en `camelCase` → `snake_case`: `cantidadDisponible` → `cantidad_disponible`.
>
> **Excepción:** `BusinessError` (`backend/src/errors/business_error.py`) ya existe con ese nombre y se mantiene así hasta que el equipo decida renombrarla.

### Reglas de estilo Python

- **Getters/Setters con `@property`**, no con métodos `get_x()` / `set_x()`:

  ```python
  class Producto:
      def __init__(self, codigo: str, precio: float):
          self._codigo = codigo
          self._precio = precio

      @property
      def precio(self) -> float:
          return self._precio

      @precio.setter
      def precio(self, value: float) -> None:
          if value <= 0:
              raise Datos_Invalidos_Exception("El precio debe ser mayor a cero.")
          self._precio = value
  ```

- **Sin setter cuando el cambio tiene reglas:** si un atributo solo puede cambiar mediante una operación de negocio, no se le define setter. Ejemplo: `Bulto.estado` cambia **solo** a través de sus transiciones, y `Stock.cantidad_disponible` **solo** con `descontar_stock()` / `incrementar_disponible()`.
- **Type hints** obligatorios en firmas públicas (parámetros y retorno).
- **Clases abstractas e interfaces** con `abc.ABC` y `@abstractmethod`.

---

## 🚨 4. Manejo de Errores

- Cada módulo define sus excepciones en `modules/<modulo>/domain/exceptions/` (los nombres están listados por módulo en `docs/implementacion.md`).
- Toda excepción de **regla de negocio** hereda de `BusinessError` (`backend/src/errors/business_error.py`):

  ```python
  from errors.business_error import BusinessError


  class Stock_Insuficiente_Exception(BusinessError):
      pass
  ```

- Los errores **técnicos** (ej. `Persistencia_Exception` por fallas de SQLite) **NO** heredan de `BusinessError`: no son violaciones de reglas, son fallas de infraestructura.
- **Prohibido** devolver códigos de error (`None`, `-1`, `False`) para señalar que una regla falló.
- La capa `api/` captura las excepciones y las traduce a respuestas con un mensaje claro para el usuario.

---

## 🧼 5. Clean Code: Guard Clauses

Validar precondiciones al inicio del método para evitar `if` anidados:

```python
# ❌ MAL (anidamiento y nombres ambiguos)
def descontar(self, c):
    if c != None:
        if c > 0:
            if self.cant_disp >= c:
                self.cant_disp -= c


# ✅ BIEN (guard clauses y nombres claros)
def descontar_stock(self, cantidad: int) -> None:
    if cantidad <= 0:
        raise Datos_Invalidos_Exception("La cantidad debe ser mayor a cero.")
    if self._cantidad_disponible < cantidad:
        raise Stock_Insuficiente_Exception("Stock insuficiente para la venta.")

    self._cantidad_disponible -= cantidad
    if self._cantidad_disponible <= self._nivel_minimo_existencia:
        self.notificar()
```

---

## 🔒 6. Reglas de Negocio e Invariantes Críticas

Ningún programador ni agente de IA puede violar estas reglas del enunciado:

1. **Trazabilidad Inmutable del Bulto (State):**
   - El ciclo de vida **SOLO** avanza en este orden: `Preparado → Precintado → En tránsito → Recibido → Verificado / Rechazado`.
   - Un estado no puede retroceder ni saltearse pasos. Toda acción inválida lanza `Transicion_Estado_Invalida_Exception`.
2. **Ingreso a Stock Vendible:**
   - La mercadería de un bulto **NUNCA** suma al stock disponible del local destino hasta que el bulto pase a `Estado_Verificado` (precinto intacto).
   - Si pasa a `Estado_Rechazado` (precinto roto), se registra como merma/pérdida y **NO** habilita venta.
3. **Restricción de Ventas:** Prohibido vender más que el stock disponible y verificado en el local.
4. **Entidades Únicas:** Sin duplicados de `Producto` (por código) ni de `Proveedor` (por CUIT). Se lanza `Entidad_Duplicada_Exception`.
5. **Devoluciones Válidas:** Solo se aceptan si están vinculadas a una venta registrada y no superan la cantidad comprada.

---

## 🧩 7. Patrones de Diseño Obligatorios

Cada patrón vive en el `domain/` del módulo dueño de esa regla:

| Patrón | Módulo | Clases |
|---|---|---|
| **State** | `logistica` | `Estado_Bulto` (base) y los estados concretos. Cada estado valida si la acción está permitida o lanza `Transicion_Estado_Invalida_Exception`. |
| **Strategy** | `ventas_caja` | `Estrategia_Pago` (abstracta) con `Pago_Efectivo`, `Pago_Tarjeta`, `Pago_Transferencia`, asignadas a `Venta.metodo_de_pago`. |
| **Observer** | `ubicaciones_stock` | `Stock` (observable) notifica cuando `cantidad_disponible <= nivel_minimo_existencia`. Observadores: `Gestor_Orden_Reposicion`, `Alerta_Stock_Service`. |

---

## 🗄️ 8. Persistencia con SQLite

- **Lógica de negocio en el dominio:** SQLite solo ejecuta `INSERT`, `UPDATE` o `SELECT`. **CERO** reglas de negocio en triggers o consultas SQL.
- **Una conexión = una transacción:** se usa `sqlite_connection()` de `config/database.py`, que hace `commit` al terminar el bloque y `rollback` si hay una excepción.
- **El service define la transacción, no el repositorio:** el caso de uso abre la conexión y se la pasa a todos los repositorios que participan. Los repositorios **nunca** abren su propia conexión ni hacen `commit`.

  ```python
  def registrar_venta(self, venta_dto: Venta_DTO) -> None:
      with sqlite_connection() as connection:
          self._stock_repository.actualizar(connection, stock)
          self._venta_repository.guardar(connection, venta)
          self._comprobante_repository.guardar(connection, comprobante)
      # Si cualquiera falla, se revierten las tres operaciones.
  ```

---

## 📝 9. Checklist antes de hacer Commit / Push

- [ ] ¿El código se ejecuta sin errores?
- [ ] ¿Los nombres respetan la sección 3 (`Pascal_Snake_Case` para clases, `snake_case` para el resto)?
- [ ] ¿El `domain/` sigue sin imports de SQL, HTTP o UI?
- [ ] ¿Los imports respetan la regla de dependencias (nada importa el `infrastructure/` de otro módulo)?
- [ ] ¿Las excepciones de negocio heredan de `BusinessError` y están en `domain/exceptions/` del módulo?
- [ ] ¿Se respetan las transiciones del bulto y la regla de no vender sin stock disponible y verificado?
- [ ] ¿Las operaciones compuestas se ejecutan en una única transacción?
