from abc import ABC


class Ubicacion(ABC):
    def __init__(self, id: str, nombre: str, direccion: str):
        self._id = id
        self._nombre = nombre
        self._direccion = direccion

    @property
    def id(self) -> str:
        return self._id

    @id.setter
    def id(self, value: str) -> None:
        self._id = value

    @property
    def nombre(self) -> str:
        return self._nombre

    @nombre.setter
    def nombre(self, value: str) -> None:
        self._nombre = value

    @property
    def direccion(self) -> str:
        return self._direccion

    @direccion.setter
    def direccion(self, value: str) -> None:
        self._direccion = value
