from __future__ import annotations

from typing import TYPE_CHECKING

from domain.patterns.stock_observer.i_observador import IObservador

if TYPE_CHECKING:
    from domain.model.inventario.stock import Stock


class GestorOrdenReposicion(IObservador):
    def actualizar(self, stock: Stock) -> None:
        raise NotImplementedError
