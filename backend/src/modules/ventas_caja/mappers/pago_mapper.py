from collections.abc import Callable

from pydantic import BaseModel

from modules.ventas_caja.domain import Estrategia_Pago, Pago_Efectivo, Pago_Tarjeta, Pago_Transferencia
from modules.ventas_caja.dto import Pago_Efectivo_DTO, Pago_Tarjeta_DTO, Pago_Transferencia_DTO

_FABRICAS: dict[type[BaseModel], Callable[..., Estrategia_Pago]] = {
    Pago_Efectivo_DTO: lambda dto: Pago_Efectivo(dto.monto_recibido),
    Pago_Tarjeta_DTO: lambda dto: Pago_Tarjeta(dto.numero_tarjeta, dto.cuotas),
    Pago_Transferencia_DTO: lambda dto: Pago_Transferencia(dto.cbu_o_alias, dto.codigo_transaccion),
}


class Pago_Mapper:
    """Convierte el DTO de pago recibido en la estrategia de cobro concreta."""

    @staticmethod
    def a_estrategia(dto: BaseModel) -> Estrategia_Pago:
        return _FABRICAS[type(dto)](dto)
