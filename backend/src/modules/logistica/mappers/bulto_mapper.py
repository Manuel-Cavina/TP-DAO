from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.dto import (
    Bulto_DTO,
    Detalle_Bulto_DTO,
    Historial_Bulto_DTO,
)
from modules.logistica.mappers.precinto_mapper import Precinto_Mapper


class Bulto_Mapper:
    """Conversor entre entidad Bulto y Bulto_DTO."""

    @staticmethod
    def detalle_a_dto(detalle: Detalle_Bulto) -> Detalle_Bulto_DTO:
        return Detalle_Bulto_DTO(
            producto_id=detalle.producto_id,
            cantidad=detalle.cantidad,
        )

    @staticmethod
    def historial_a_dto(h: Historial_Bulto, bulto_id: int | None) -> Historial_Bulto_DTO:
        return Historial_Bulto_DTO(
            bulto_id=bulto_id,
            estado_anterior=h.estado_anterior,
            estado_nuevo=h.estado_nuevo,
            fecha_hora=h.fecha_hora.isoformat(),
            observacion=h.observacion,
        )

    @classmethod
    def a_dto(cls, bulto: Bulto) -> Bulto_DTO:
        return Bulto_DTO(
            id=bulto.id,
            orden_id=bulto.orden_id,
            estado=bulto.estado.nombre,
            precinto=Precinto_Mapper.a_dto(bulto.precinto),
            detalles=[cls.detalle_a_dto(d) for d in bulto.detalles],
            historial=[cls.historial_a_dto(h, bulto.id) for h in bulto.historial],
        )
