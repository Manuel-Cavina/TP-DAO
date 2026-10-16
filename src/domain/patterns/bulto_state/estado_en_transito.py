from __future__ import annotations

from typing import TYPE_CHECKING

from domain.patterns.bulto_state.estado_bulto import EstadoBulto

if TYPE_CHECKING:
    from domain.model.logistica.bulto import Bulto


class EstadoEnTransito(EstadoBulto):
    def recibir(self, b: Bulto) -> None:
        raise NotImplementedError
