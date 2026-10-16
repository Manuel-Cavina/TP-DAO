from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from domain.model.inventario.stock import Stock


class IObservador(ABC):
    @abstractmethod
    def actualizar(self, stock: Stock) -> None:
        ...
