from __future__ import annotations

from typing import TYPE_CHECKING

from domain.patterns.bulto_state.estado_bulto import EstadoBulto

if TYPE_CHECKING:
    from domain.model.logistica.bulto import Bulto


class EstadoRecibido(EstadoBulto):
    def verificar(self, b: Bulto, precinto_intacto: bool) -> None:
        raise NotImplementedError
