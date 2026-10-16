from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.dto import (
    Detalle_Orden_Reposicion_DTO,
    Orden_Reposicion_DTO,
)


class Orden_Reposicion_Mapper:
    """Conversor entre entidad Orden_Reposicion y Orden_Reposicion_DTO."""

    @staticmethod
    def detalle_a_dto(d: Detalle_Orden_Reposicion) -> Detalle_Orden_Reposicion_DTO:
        return Detalle_Orden_Reposicion_DTO(
            producto_id=d.producto_id,
            cantidad_solicitada=d.cantidad_solicitada,
            cantidad_enviada=d.cantidad_enviada,
        )

    @classmethod
    def a_dto(cls, orden: Orden_Reposicion) -> Orden_Reposicion_DTO:
        return Orden_Reposicion_DTO(
            id=int(orden.id) if orden.id is not None else None,
            origen_id=orden.origen_id,
            destino_id=orden.destino_id,
            fecha=orden.fecha.isoformat(),
            estado=orden.estado,
            detalles=[cls.detalle_a_dto(d) for d in orden.detalles],
        )
