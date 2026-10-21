from dataclasses import dataclass
from datetime import date, datetime, time

from modules.reportes.domain.exceptions import Rango_Fechas_Invalido_Exception


@dataclass(frozen=True)
class Rango_Fechas:
    """Período de un reporte, inclusive en ambos extremos (días completos)."""

    desde: date
    hasta: date

    def __post_init__(self) -> None:
        if self.desde > self.hasta:
            raise Rango_Fechas_Invalido_Exception(
                f"La fecha desde ({self.desde}) no puede ser posterior a la fecha hasta ({self.hasta})."
            )

    @property
    def inicio(self) -> datetime:
        return datetime.combine(self.desde, time.min)

    @property
    def fin(self) -> datetime:
        return datetime.combine(self.hasta, time.max)
