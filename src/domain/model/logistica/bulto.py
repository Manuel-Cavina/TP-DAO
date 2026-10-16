from domain.model.logistica.precinto import Precinto
from domain.patterns.bulto_state.estado_bulto import EstadoBulto


class Bulto:
    def __init__(self, id: str, estado: EstadoBulto, precinto: Precinto | None = None):
        self._id = id
        self._estado = estado
        self._precinto = precinto

    @property
    def id(self) -> str:
        return self._id

    @id.setter
    def id(self, value: str) -> None:
        self._id = value

    @property
    def estado(self) -> EstadoBulto:
        return self._estado

    @property
    def precinto(self) -> Precinto | None:
        return self._precinto

    @precinto.setter
    def precinto(self, value: Precinto | None) -> None:
        self._precinto = value

    def cambiar_estado(self, nuevo_estado: EstadoBulto) -> None:
        raise NotImplementedError

    def verificar_precinto(self, esta_intacto: bool) -> None:
        raise NotImplementedError
