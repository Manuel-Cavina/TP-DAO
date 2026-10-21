from typing import Any

from modules.logistica.domain.evento_trazabilidad import Evento_Trazabilidad
from modules.logistica.domain.exceptions import (
    Bulto_No_Encontrado_Exception,
    Orden_No_Encontrada_Exception,
)
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.historial_bulto_repository import Historial_Bulto_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository
from modules.logistica.infrastructure.trazabilidad_repository import Trazabilidad_Repository


class Trazabilidad_Service:
    """Caso de uso para consulta y registro de trazabilidad inmutable y auditoria logística (V2/US3)."""

    def __init__(
        self,
        historial_repository: Historial_Bulto_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
        trazabilidad_repository: Trazabilidad_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
    ) -> None:
        self._historial_repository = (
            historial_repository
            if historial_repository is not None
            else Historial_Bulto_Repository()
        )
        self._bulto_repository = (
            bulto_repository if bulto_repository is not None else Bulto_Repository()
        )
        self._trazabilidad_repository = (
            trazabilidad_repository
            if trazabilidad_repository is not None
            else Trazabilidad_Repository()
        )
        self._orden_repository = (
            orden_repository
            if orden_repository is not None
            else Orden_Reposicion_Repository()
        )

    def registrar_evento(self, evento: Evento_Trazabilidad) -> Evento_Trazabilidad:
        """Persiste un nuevo evento de trazabilidad inmutable."""
        return self._trazabilidad_repository.guardar(evento)

    def consultar_historial_entidad(
        self, tipo_entidad: str, entidad_id: int
    ) -> list[Evento_Trazabilidad]:
        """Recupera la línea de tiempo inmutable de una entidad."""
        return self._trazabilidad_repository.listar_por_entidad(tipo_entidad, entidad_id)

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
        """Devuelve un resumen con estado actual y el historial completo del bulto."""
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

    def consultar_resumen_orden(self, orden_id: int) -> dict[str, Any]:
        """Devuelve la trazabilidad completa y resumen de una orden de reposicion."""
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_No_Encontrada_Exception(f"No se encontro la orden con ID {orden_id}.")
        eventos = self._trazabilidad_repository.listar_por_entidad("ORDEN", orden_id)
        return {
            "orden_id": orden.id,
            "origen_id": orden.origen_id,
            "destino_id": orden.destino_id,
            "estado_actual": orden.estado,
            "eventos": [
                {
                    "id": e.id,
                    "tipo_entidad": e.tipo_entidad,
                    "entidad_id": e.entidad_id,
                    "accion": e.accion,
                    "estado_anterior": e.estado_anterior,
                    "estado_nuevo": e.estado_nuevo,
                    "actor": e.actor,
                    "origen_id": e.origen_id,
                    "destino_id": e.destino_id,
                    "registros_asociados": e.registros_asociados,
                    "motivo_o_evidencia": e.motivo_o_evidencia,
                    "fecha_hora": e.fecha_hora.isoformat() if e.fecha_hora else None,
                }
                for e in eventos
            ],
        }
