from __future__ import annotations

from abc import ABC
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from domain.model.logistica.bulto import Bulto


class EstadoBulto(ABC):
    """Base state. Transitions not overridden by a concrete state are invalid."""

    def despachar(self, b: Bulto) -> None:
        raise NotImplementedError

    def recibir(self, b: Bulto) -> None:
        raise NotImplementedError

    def verificar(self, b: Bulto, precinto_intacto: bool) -> None:
        raise NotImplementedError
