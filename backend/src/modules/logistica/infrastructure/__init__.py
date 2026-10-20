"""Repositorios e infraestructura ORM del modulo de logistica."""

from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.historial_bulto_repository import (
    Historial_Bulto_Repository,
)
from modules.logistica.infrastructure.models import (
    Bulto_Model,
    Detalle_Bulto_Model,
    Detalle_Orden_Reposicion_Model,
    Historial_Bulto_Model,
    Necesidad_Reposicion_Model,
    Orden_Reposicion_Model,
    Precinto_Model,
    Remito_Model,
)
from modules.logistica.infrastructure.necesidad_reposicion_repository import (
    Necesidad_Reposicion_Repository,
)
from modules.logistica.infrastructure.orden_reposicion_repository import (
    Orden_Reposicion_Repository,
)
from modules.logistica.infrastructure.precinto_repository import Precinto_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository
from modules.logistica.infrastructure.stock_logistica_adapter import Stock_Logistica_Adapter

__all__ = [
    "Bulto_Repository",
    "Historial_Bulto_Repository",
    "Necesidad_Reposicion_Repository",
    "Orden_Reposicion_Repository",
    "Precinto_Repository",
    "Remito_Repository",
    "Stock_Logistica_Adapter",
    "Bulto_Model",
    "Detalle_Bulto_Model",
    "Detalle_Orden_Reposicion_Model",
    "Historial_Bulto_Model",
    "Necesidad_Reposicion_Model",
    "Orden_Reposicion_Model",
    "Precinto_Model",
    "Remito_Model",
]
