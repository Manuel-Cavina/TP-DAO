from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from modules.ventas_caja.domain.exceptions import Pago_Rechazado_Exception

CENTAVOS = Decimal("0.01")
# Tope de un importe: entra en Numeric(12, 2) y evita InvalidOperation al redondear.
MONTO_MAXIMO = Decimal("9999999999.99")


@dataclass(frozen=True)
class Resultado_Pago:
    """Resultado inmutable de un cobro: lo que entra a la caja y cómo se cobró."""

    medio_pago: str
    monto_cobrado: Decimal
    recargo: Decimal = Decimal("0.00")
    vuelto: Decimal = Decimal("0.00")
    detalle: str = ""


class Estrategia_Pago(ABC):
    """Strategy de cobro: cada medio de pago valida y calcula su propio cobro."""

    @property
    @abstractmethod
    def medio_pago(self) -> str:
        """Nombre del medio de pago que se guarda en el comprobante."""
        raise NotImplementedError

    def procesar_pago(self, monto: Decimal) -> Resultado_Pago:
        """Valida el monto a cobrar y delega el cálculo en el medio concreto."""
        validar_monto(monto, "El monto a cobrar")
        return self._cobrar(redondear(monto))

    @abstractmethod
    def _cobrar(self, monto: Decimal) -> Resultado_Pago:
        raise NotImplementedError


def validar_monto(monto: Decimal, nombre: str) -> None:
    """Rechaza importes que no son Decimal finitos entre cero (exclusive) y MONTO_MAXIMO."""
    if not isinstance(monto, Decimal) or not monto.is_finite() or not 0 < monto <= MONTO_MAXIMO:
        raise Pago_Rechazado_Exception(f"{nombre} debe ser un Decimal mayor a cero y hasta {MONTO_MAXIMO}.")


def redondear(monto: Decimal) -> Decimal:
    """Redondea un importe a centavos con el criterio comercial habitual."""
    return monto.quantize(CENTAVOS, rounding=ROUND_HALF_UP)
