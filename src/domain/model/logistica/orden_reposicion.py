from domain.model.ubicaciones.centro_distribucion import CentroDistribucion
from domain.model.ubicaciones.local import Local


class OrdenReposicion:
    def __init__(self, id: str, estado: str, origen: CentroDistribucion, destino: Local):
        self._id = id
        self._estado = estado
        self._origen = origen
        self._destino = destino

    @property
    def id(self) -> str:
        return self._id

    @id.setter
    def id(self, value: str) -> None:
        self._id = value

    @property
    def estado(self) -> str:
        return self._estado

    @estado.setter
    def estado(self, value: str) -> None:
        self._estado = value

    @property
    def origen(self) -> CentroDistribucion:
        return self._origen

    @origen.setter
    def origen(self, value: CentroDistribucion) -> None:
        self._origen = value

    @property
    def destino(self) -> Local:
        return self._destino

    @destino.setter
    def destino(self, value: Local) -> None:
        self._destino = value
