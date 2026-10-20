from decimal import Decimal

from modules.ventas_caja.domain.estrategia_pago import (
    Estrategia_Pago,
    Resultado_Pago,
    redondear,
    validar_monto,
)
from modules.ventas_caja.domain.exceptions import Pago_Rechazado_Exception


class Pago_Efectivo(Estrategia_Pago):
    """Cobro en efectivo: el monto recibido debe cubrir el total y se calcula el vuelto."""

    def __init__(self, monto_recibido: Decimal) -> None:
        validar_monto(monto_recibido, "El monto recibido en efectivo")
        self._monto_recibido = redondear(monto_recibido)

    @property
    def medio_pago(self) -> str:
        return "EFECTIVO"

    @property
    def monto_recibido(self) -> Decimal:
        return self._monto_recibido

    def _cobrar(self, monto: Decimal) -> Resultado_Pago:
        if self._monto_recibido < monto:
            raise Pago_Rechazado_Exception(
                f"El efectivo recibido ({self._monto_recibido}) no cubre el total ({monto})."
            )
        return Resultado_Pago(
            medio_pago=self.medio_pago,
            monto_cobrado=monto,
            vuelto=self._monto_recibido - monto,
            detalle=f"Recibido {self._monto_recibido}",
        )
