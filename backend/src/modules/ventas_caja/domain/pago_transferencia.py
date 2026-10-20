import re
from decimal import Decimal

from modules.ventas_caja.domain.estrategia_pago import Estrategia_Pago, Resultado_Pago
from modules.ventas_caja.domain.exceptions import Pago_Rechazado_Exception

_CBU = re.compile(r"[0-9]{22}")
_ALIAS = re.compile(r"[A-Za-z0-9.\-]{6,20}")


class Pago_Transferencia(Estrategia_Pago):
    """Cobro por transferencia: exige CBU (22 dígitos) o alias y el código de transacción."""

    def __init__(self, cbu_o_alias: str, codigo_transaccion: str) -> None:
        destino = cbu_o_alias.strip() if isinstance(cbu_o_alias, str) else ""
        codigo = codigo_transaccion.strip() if isinstance(codigo_transaccion, str) else ""
        es_cbu = _CBU.fullmatch(destino) is not None
        es_alias = _ALIAS.fullmatch(destino) is not None and not destino.isdigit()
        if not (es_cbu or es_alias):
            raise Pago_Rechazado_Exception(
                "La transferencia requiere un CBU de 22 dígitos o un alias de 6 a 20 caracteres."
            )
        if not codigo:
            raise Pago_Rechazado_Exception("La transferencia requiere el código de transacción.")
        self._cbu_o_alias = destino
        self._codigo_transaccion = codigo

    @property
    def medio_pago(self) -> str:
        return "TRANSFERENCIA"

    @property
    def cbu_o_alias(self) -> str:
        return self._cbu_o_alias

    @property
    def codigo_transaccion(self) -> str:
        return self._codigo_transaccion

    def _cobrar(self, monto: Decimal) -> Resultado_Pago:
        return Resultado_Pago(
            medio_pago=self.medio_pago,
            monto_cobrado=monto,
            detalle=f"Transferencia desde {self._cbu_o_alias}, operación {self._codigo_transaccion}",
        )
