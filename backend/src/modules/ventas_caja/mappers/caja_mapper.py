from modules.ventas_caja.domain import Saldo_Caja
from modules.ventas_caja.dto import Saldo_Caja_DTO


class Saldo_Caja_Mapper:
    """Conversor del saldo calculado de caja a su DTO."""

    @staticmethod
    def a_dto(saldo: Saldo_Caja) -> Saldo_Caja_DTO:
        return Saldo_Caja_DTO(
            local_id=saldo.local_id,
            desde=saldo.desde,
            hasta=saldo.hasta,
            cantidad_ventas=saldo.cantidad_ventas,
            total_ventas=saldo.total_ventas,
            cantidad_devoluciones=saldo.cantidad_devoluciones,
            total_devoluciones=saldo.total_devoluciones,
            saldo=saldo.saldo,
        )
