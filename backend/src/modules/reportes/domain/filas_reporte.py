"""Filas de los reportes: valores calculados a partir de lo que leen las consultas.

Cada clase agrupa los datos crudos de una fila y expone sus cálculos de negocio
(neto, margen, faltante, valorización, horas), así la regla vive en un solo lugar.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENTAVOS = Decimal("0.01")
CERO = Decimal("0.00")


def _redondear(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVOS, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Ventas_Por_Medio_Pago:
    """Reporte 1: ventas e ingresos de un local con un medio de pago en el período."""

    local_id: int
    local_nombre: str
    medio_pago: str
    cantidad_ventas: int
    total_bruto: Decimal
    cantidad_devoluciones: int
    total_devoluciones: Decimal

    @property
    def total_neto(self) -> Decimal:
        return self.total_bruto - self.total_devoluciones


@dataclass(frozen=True)
class Producto_Vendido:
    """Reporte 2: unidades netas, ingresos, costo estimado y margen de un producto."""

    producto_id: int
    codigo: str
    nombre: str
    unidades_vendidas: int
    unidades_devueltas: int
    ingresos_brutos: Decimal
    ingresos_devueltos: Decimal
    costo_unitario: Decimal

    @property
    def unidades_netas(self) -> int:
        return self.unidades_vendidas - self.unidades_devueltas

    @property
    def ingresos(self) -> Decimal:
        return self.ingresos_brutos - self.ingresos_devueltos

    @property
    def costo(self) -> Decimal:
        """Estimado con el costo unitario vigente del producto."""
        return _redondear(self.costo_unitario * self.unidades_netas)

    @property
    def margen(self) -> Decimal:
        return self.ingresos - self.costo

    @property
    def margen_porcentaje(self) -> Decimal:
        if self.ingresos == 0:
            return CERO
        return _redondear(self.margen * 100 / self.ingresos)

    @property
    def margen_negativo(self) -> bool:
        return self.margen < 0


@dataclass(frozen=True)
class Existencia:
    """Reporte 3: stock de un producto en una ubicación, con faltante y valorización."""

    producto_id: int
    codigo: str
    nombre: str
    ubicacion_id: int
    ubicacion_nombre: str
    cantidad_disponible: int
    cantidad_en_transito: int
    nivel_minimo_existencia: int
    costo_unitario: Decimal

    @property
    def faltante(self) -> int:
        """Unidades que faltan para volver a estar por encima del mínimo."""
        return max(self.nivel_minimo_existencia - self.cantidad_disponible, 0)

    @property
    def en_o_bajo_minimo(self) -> bool:
        return self.cantidad_disponible <= self.nivel_minimo_existencia

    @property
    def valorizacion(self) -> Decimal:
        return _redondear(self.costo_unitario * self.cantidad_disponible)


@dataclass(frozen=True)
class Merma_Bulto:
    """Reporte 4: bulto rechazado por precinto violado y lo que se perdió."""

    bulto_id: int
    remito_numero: str | None
    local_id: int
    local_nombre: str
    fecha_rechazo: str
    unidades_perdidas: int
    valor_perdido: Decimal
    productos: tuple[str, ...]


@dataclass(frozen=True)
class Tiempo_Transito_Local:
    """Reporte 5: horas entre el despacho (En_Transito) y la recepción (Recibido) por local."""

    local_id: int
    local_nombre: str
    horas: tuple[Decimal, ...]

    @property
    def cantidad_bultos(self) -> int:
        return len(self.horas)

    @property
    def promedio_horas(self) -> Decimal:
        return _redondear(sum(self.horas, CERO) / len(self.horas))

    @property
    def minimo_horas(self) -> Decimal:
        return min(self.horas)

    @property
    def maximo_horas(self) -> Decimal:
        return max(self.horas)
