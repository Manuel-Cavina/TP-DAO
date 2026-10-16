"""Repositorios e infraestructura SQLite del modulo de logistica."""

from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.historial_bulto_repository import (
    Historial_Bulto_Repository,
)
from modules.logistica.infrastructure.necesidad_reposicion_repository import (
    Necesidad_Reposicion_Repository,
)
from modules.logistica.infrastructure.orden_reposicion_repository import (
    Orden_Reposicion_Repository,
)
from modules.logistica.infrastructure.precinto_repository import Precinto_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository
from modules.logistica.infrastructure.schema import (
    DDL_LOGISTICA,
    crear_tablas_logistica,
)

__all__ = [
    "DDL_LOGISTICA",
    "crear_tablas_logistica",
    "Bulto_Repository",
    "Historial_Bulto_Repository",
    "Necesidad_Reposicion_Repository",
    "Orden_Reposicion_Repository",
    "Precinto_Repository",
    "Remito_Repository",
]
