from dataclasses import dataclass, field
from datetime import datetime

from modules.logistica.domain.exceptions import Motivo_Rechazo_Requerido_Exception


@dataclass
class Control_Precinto:
    """Entidad de dominio que representa la evidencia inmutable de control de precinto de un bulto (US5 / T056)."""

    bulto_id: int
    codigo_esperado: str
    codigo_leido: str
    resultado: str  # "VERIFICADO" | "RECHAZADO"
    motivo_rechazo: str = ""
    actor: str = "Operador"
    ubicacion_id: int | None = None
    fecha_hora: datetime = field(default_factory=datetime.now)
    version_bulto: int = 1
    id: int | None = None

    def __post_init__(self) -> None:
        codigo_esperado_limpio = self.codigo_esperado.strip()
        codigo_leido_limpio = self.codigo_leido.strip()

        if codigo_esperado_limpio != codigo_leido_limpio:
            self.resultado = "RECHAZADO"
        elif self.resultado not in ("VERIFICADO", "RECHAZADO"):
            self.resultado = "VERIFICADO"

        if (self.resultado == "RECHAZADO" or codigo_esperado_limpio != codigo_leido_limpio) and not self.motivo_rechazo.strip():
            raise Motivo_Rechazo_Requerido_Exception(
                "Es obligatorio registrar un motivo de rechazo para precintos violados o no coincidentes."
            )
