from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from modules.ubicaciones_stock.domain.stock import Stock


class Stock_Observer(ABC):
    """Observer: recibe aviso cuando el disponible de un Stock baja a su nivel mínimo o menos."""

    @abstractmethod
    def notificar_stock_bajo(self, stock: Stock) -> None:
        raise NotImplementedError
