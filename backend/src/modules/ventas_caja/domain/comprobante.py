from datetime import datetime
from decimal import Decimal

from modules.ventas_caja.domain.estrategia_pago import Resultado_Pago
from modules.ventas_caja.domain.exceptions import Venta_Invalida_Exception


class Comprobante:
    """Comprobante emitido al confirmar una venta, con numeración correlativa por local."""

    def __init__(
        self,
        numero: int,
        local_id: int,
        fecha_emision: datetime,
        total: Decimal,
        pago: Resultado_Pago,
    ) -> None:
        if not isinstance(numero, int) or isinstance(numero, bool) or numero <= 0:
            raise Venta_Invalida_Exception("El número de comprobante debe ser un entero positivo.")
        if not isinstance(fecha_emision, datetime):
            raise Venta_Invalida_Exception("La fecha de emisión del comprobante debe ser datetime.")

        self._numero = numero
        self._local_id = local_id
        self._fecha_emision = fecha_emision
        self._total = total
        self._pago = pago

    @property
    def numero(self) -> int:
        return self._numero

    @property
    def numero_formateado(self) -> str:
        """Número con punto de venta: <local>-<correlativo>, por ejemplo 0010-00000001."""
        return f"{self._local_id:04d}-{self._numero:08d}"

    @property
    def local_id(self) -> int:
        return self._local_id

    @property
    def fecha_emision(self) -> datetime:
        return self._fecha_emision

    @property
    def total(self) -> Decimal:
        """Total de la venta, sin recargos del medio de pago."""
        return self._total

    @property
    def pago(self) -> Resultado_Pago:
        return self._pago

    @property
    def medio_pago(self) -> str:
        return self._pago.medio_pago

    @property
    def total_cobrado(self) -> Decimal:
        """Lo que efectivamente ingresó a la caja (total más recargo)."""
        return self._pago.monto_cobrado
