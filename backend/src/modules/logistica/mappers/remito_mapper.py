from modules.logistica.domain.remito import Remito
from modules.logistica.dto import Remito_DTO
from modules.logistica.mappers.bulto_mapper import Bulto_Mapper


class Remito_Mapper:
    """Conversor entre entidad Remito y Remito_DTO.

    Lee estados canónicos y normaliza el estado legacy EN_TRANSITO a DESPACHADO (T049).
    """

    @staticmethod
    def a_dto(remito: Remito) -> Remito_DTO:
        estado_normalizado = remito.estado.strip().upper() if remito.estado else "EMITIDO"
        if estado_normalizado == "EN_TRANSITO":
            estado_normalizado = "DESPACHADO"

        return Remito_DTO(
            numero=remito.numero,
            origen_id=remito.origen_id,
            destino_id=remito.destino_id,
            fecha_emision=remito.fecha_emision.isoformat(),
            estado=estado_normalizado,
            bultos=[Bulto_Mapper.a_dto(b) for b in remito.bultos],
            orden_id=remito.orden_id,
        )
