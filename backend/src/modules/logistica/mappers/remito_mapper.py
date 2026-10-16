from modules.logistica.domain.remito import Remito
from modules.logistica.dto import Remito_DTO
from modules.logistica.mappers.bulto_mapper import Bulto_Mapper


class Remito_Mapper:
    """Conversor entre entidad Remito y Remito_DTO."""

    @staticmethod
    def a_dto(remito: Remito) -> Remito_DTO:
        return Remito_DTO(
            numero=remito.numero,
            origen_id=remito.origen_id,
            destino_id=remito.destino_id,
            fecha_emision=remito.fecha_emision.isoformat(),
            estado=remito.estado,
            bultos=[Bulto_Mapper.a_dto(b) for b in remito.bultos],
        )
