from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class Saldo_Caja:
    """Saldo calculado de la caja de un local: no se persiste, se deriva de ventas y devoluciones."""

    local_id: int
    desde: date
    hasta: date
    cantidad_ventas: int
    total_ventas: Decimal
    cantidad_devoluciones: int
    total_devoluciones: Decimal

    @property
    def saldo(self) -> Decimal:
        return self.total_ventas - self.total_devoluciones
