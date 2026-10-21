from typing import Any

from modules.logistica.domain.exceptions import Bulto_No_Encontrado_Exception
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.historial_bulto_repository import Historial_Bulto_Repository


class Trazabilidad_Service:
    """Caso de uso para consulta de trazabilidad inmutable y auditoria de bultos (V2)."""

    def __init__(
        self,
        historial_repository: Historial_Bulto_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
    ) -> None:
        self._historial_repository = (
            historial_repository
            if historial_repository is not None
            else Historial_Bulto_Repository()
        )
        self._bulto_repository = (
            bulto_repository if bulto_repository is not None else Bulto_Repository()
        )

    def consultar_historial_bulto(
        self, bulto_id: int
    ) -> list[Historial_Bulto]:
        """Obtiene la linea temporal completa e inmutable de eventos de un bulto."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")
        return self._historial_repository.listar_por_bulto(bulto_id)

    def consultar_resumen_trazabilidad(
        self, bulto_id: int
    ) -> dict[str, Any]:
        """Devuelve un resumen con estado actual y el historial completo."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")
        historial = self._historial_repository.listar_por_bulto(bulto_id)

        return {
            "bulto_id": bulto.id,
            "orden_id": bulto.orden_id,
            "estado_actual": bulto.estado.nombre,
            "codigo_precinto": bulto.precinto.codigo if bulto.precinto else None,
            "total_items": sum(d.cantidad for d in bulto.detalles),
            "eventos": [
                {
                    "estado_anterior": h.estado_anterior,
                    "estado_nuevo": h.estado_nuevo,
                    "fecha_hora": h.fecha_hora.isoformat(),
                    "observacion": h.observacion,
                }
                for h in historial
            ],
        }
