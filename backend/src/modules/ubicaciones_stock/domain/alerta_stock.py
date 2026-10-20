from datetime import datetime


class Alerta_Stock:
    """Aviso de stock en o bajo el mínimo, generado por el Observer para el frontend."""

    def __init__(
        self,
        stock_id: int,
        producto_id: int,
        ubicacion_id: int,
        cantidad_disponible: int,
        nivel_minimo: int,
        fecha_emision: datetime,
        leida: bool = False,
        id: int | None = None,
    ) -> None:
        self._id = id
        self._stock_id = stock_id
        self._producto_id = producto_id
        self._ubicacion_id = ubicacion_id
        self._cantidad_disponible = cantidad_disponible
        self._nivel_minimo = nivel_minimo
        self._fecha_emision = fecha_emision
        self._leida = leida

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        self._id = valor

    @property
    def stock_id(self) -> int:
        return self._stock_id

    @property
    def producto_id(self) -> int:
        return self._producto_id

    @property
    def ubicacion_id(self) -> int:
        return self._ubicacion_id

    @property
    def cantidad_disponible(self) -> int:
        return self._cantidad_disponible

    @property
    def nivel_minimo(self) -> int:
        return self._nivel_minimo

    @property
    def fecha_emision(self) -> datetime:
        return self._fecha_emision

    @property
    def leida(self) -> bool:
        return self._leida

    def marcar_leida(self) -> None:
        self._leida = True
