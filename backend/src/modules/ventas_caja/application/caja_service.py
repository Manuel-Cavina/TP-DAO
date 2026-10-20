from datetime import date, datetime, time

from modules.ventas_caja.application.stock_venta_contract import Stock_Venta_Contract
from modules.ventas_caja.domain import Saldo_Caja
from modules.ventas_caja.domain.exceptions import Periodo_Caja_Invalido_Exception
from modules.ventas_caja.infrastructure.devolucion_repository import Devolucion_Repository
from modules.ventas_caja.infrastructure.venta_repository import Venta_Repository


class Caja_Service:
    """Calcula la caja de un local: ventas cobradas menos devoluciones reintegradas. No se persiste."""

    def __init__(
        self,
        stock: Stock_Venta_Contract,
        venta_repository: Venta_Repository | None = None,
        devolucion_repository: Devolucion_Repository | None = None,
    ) -> None:
        self._stock = stock
        self._venta_repository = venta_repository if venta_repository is not None else Venta_Repository()
        self._devolucion_repository = (
            devolucion_repository if devolucion_repository is not None else Devolucion_Repository()
        )

    def calcular_saldo(self, local_id: int, desde: date, hasta: date) -> Saldo_Caja:
        """Saldo del local entre ambas fechas, inclusive los dos días completos."""
        if desde > hasta:
            raise Periodo_Caja_Invalido_Exception(
                f"La fecha desde ({desde}) no puede ser posterior a la fecha hasta ({hasta})."
            )
        self._stock.validar_local(local_id)

        inicio = datetime.combine(desde, time.min)
        fin = datetime.combine(hasta, time.max)
        cantidad_ventas, total_ventas = self._venta_repository.total_cobrado(local_id, inicio, fin)
        cantidad_devoluciones, total_devoluciones = self._devolucion_repository.total_reintegrado(
            local_id, inicio, fin
        )
        return Saldo_Caja(
            local_id=local_id,
            desde=desde,
            hasta=hasta,
            cantidad_ventas=cantidad_ventas,
            total_ventas=total_ventas,
            cantidad_devoluciones=cantidad_devoluciones,
            total_devoluciones=total_devoluciones,
        )
