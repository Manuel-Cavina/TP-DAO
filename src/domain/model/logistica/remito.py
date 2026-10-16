from datetime import date

from domain.model.logistica.bulto import Bulto


class Remito:
    def __init__(self, id: str, fecha_emision: date, bultos: list[Bulto] | None = None):
        self._id = id
        self._fecha_emision = fecha_emision
        self._bultos = bultos if bultos is not None else []

    @property
    def id(self) -> str:
        return self._id

    @id.setter
    def id(self, value: str) -> None:
        self._id = value

    @property
    def fecha_emision(self) -> date:
        return self._fecha_emision

    @fecha_emision.setter
    def fecha_emision(self, value: date) -> None:
        self._fecha_emision = value

    @property
    def bultos(self) -> list[Bulto]:
        return self._bultos

    @bultos.setter
    def bultos(self, value: list[Bulto]) -> None:
        self._bultos = value
