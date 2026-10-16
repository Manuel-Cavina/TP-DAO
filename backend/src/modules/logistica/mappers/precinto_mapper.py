from modules.logistica.domain.precinto import Precinto
from modules.logistica.dto import Precinto_DTO


class Precinto_Mapper:
    """Conversor entre entidad Precinto y Precinto_DTO."""

    @staticmethod
    def a_dto(precinto: Precinto | None) -> Precinto_DTO | None:
        if precinto is None:
            return None
        return Precinto_DTO(
            codigo=precinto.codigo,
            esta_intacto=precinto.esta_intacto,
        )

    @staticmethod
    def a_entidad(dto: Precinto_DTO) -> Precinto:
        return Precinto(
            codigo=dto.codigo,
            esta_intacto=dto.esta_intacto,
        )
