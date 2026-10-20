import re
from decimal import Decimal

from modules.ventas_caja.domain.estrategia_pago import Estrategia_Pago, Resultado_Pago, redondear
from modules.ventas_caja.domain.exceptions import Pago_Rechazado_Exception

# Recargo por cuotas acordado por el equipo (docs/implementacion.md, Integrante 3).
RECARGO_POR_CUOTAS: dict[int, Decimal] = {
    1: Decimal("0.00"),
    3: Decimal("0.10"),
    6: Decimal("0.20"),
    12: Decimal("0.35"),
}
_NUMERO_TARJETA = re.compile(r"[0-9]{13,19}")


class Pago_Tarjeta(Estrategia_Pago):
    """Cobro con tarjeta en 1, 3, 6 o 12 cuotas, con recargo según la cantidad de cuotas."""

    def __init__(self, numero_tarjeta: str, cuotas: int) -> None:
        numero = numero_tarjeta.replace(" ", "") if isinstance(numero_tarjeta, str) else ""
        # Regex ASCII: str.isdigit() aceptaría dígitos de otros alfabetos (por ejemplo, arábigos).
        if not _NUMERO_TARJETA.fullmatch(numero):
            raise Pago_Rechazado_Exception("El número de tarjeta debe tener entre 13 y 19 dígitos.")
        if isinstance(cuotas, bool) or cuotas not in RECARGO_POR_CUOTAS:
            cuotas_validas = ", ".join(str(c) for c in RECARGO_POR_CUOTAS)
            raise Pago_Rechazado_Exception(f"Cuotas inválidas: se admiten {cuotas_validas}.")
        self._ultimos_digitos = numero[-4:]
        self._cuotas = cuotas

    @property
    def medio_pago(self) -> str:
        return "TARJETA"

    @property
    def cuotas(self) -> int:
        return self._cuotas

    @property
    def ultimos_digitos(self) -> str:
        return self._ultimos_digitos

    def _cobrar(self, monto: Decimal) -> Resultado_Pago:
        recargo = redondear(monto * RECARGO_POR_CUOTAS[self._cuotas])
        return Resultado_Pago(
            medio_pago=self.medio_pago,
            monto_cobrado=monto + recargo,
            recargo=recargo,
            detalle=f"Tarjeta **** {self._ultimos_digitos} en {self._cuotas} cuota(s)",
        )
