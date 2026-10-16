from collections import defaultdict
from typing import Any

from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.exceptions import Orden_Invalida_Exception
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.infrastructure import (
    Necesidad_Reposicion_Repository,
    Orden_Reposicion_Repository,
)


class Reposicion_Service:
    """Caso de uso para la gestion y consolidacion de necesidades en ordenes de reposicion (P3)."""

    def __init__(
        self,
        orden_repository: Orden_Reposicion_Repository | None = None,
        necesidad_repository: Necesidad_Reposicion_Repository | None = None,
    ) -> None:
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._necesidad_repository = (
            necesidad_repository
            if necesidad_repository is not None
            else Necesidad_Reposicion_Repository()
        )

    def registrar_necesidad(
        self,
        producto_id: int,
        local_id: int,
        cantidad: int,
    ) -> int | None:
        """Contrato oficial usado por el Observer de Stock y cargas manuales."""
        return self._necesidad_repository.registrar(producto_id, local_id, cantidad)

    def listar_necesidades_pendientes(
        self, local_id: int | None = None
    ) -> list[dict[str, Any]]:
        """Lista las necesidades pendientes generadas para un local o todos."""
        return self._necesidad_repository.listar_pendientes(local_id)

    def consolidar_necesidades_en_orden(
        self, local_destino_id: int, origen_id: int
    ) -> Orden_Reposicion:
        """Consolida las necesidades pendientes de un local en una Orden_Reposicion (P3)."""
        pendientes = self._necesidad_repository.listar_pendientes(local_destino_id)
        if not pendientes:
            raise Orden_Invalida_Exception(
                f"No existen necesidades pendientes para consolidar hacia el local '{local_destino_id}'."
            )

        acumulados: dict[int, int] = defaultdict(int)
        necesidad_ids: list[int] = []

        for p in pendientes:
            acumulados[p["producto_id"]] += p["cantidad"]
            necesidad_ids.append(p["id"])

        detalles = [
            Detalle_Orden_Reposicion(
                producto_id=prod, cantidad_solicitada=cant, cantidad_enviada=0
            )
            for prod, cant in acumulados.items()
        ]

        orden = Orden_Reposicion(
            origen_id=origen_id,
            destino_id=local_destino_id,
            detalles=detalles,
        )
        orden_guardada = self._orden_repository.guardar(orden)
        self._necesidad_repository.consolidar_en_orden(
            necesidad_ids, orden_guardada.id or 0
        )

        return orden_guardada

    def crear_orden_manual(
        self, origen_id: int, destino_id: int, items: list[dict[str, Any]]
    ) -> Orden_Reposicion:
        """Permite cargar una orden de reposicion de forma manual."""
        if not items:
            raise Orden_Invalida_Exception("La orden debe contener al menos un producto.")

        detalles = [
            Detalle_Orden_Reposicion(
                producto_id=it["producto_id"],
                cantidad_solicitada=it["cantidad"],
                cantidad_enviada=0,
            )
            for it in items
        ]
        orden = Orden_Reposicion(
            origen_id=origen_id, destino_id=destino_id, detalles=detalles
        )
        return self._orden_repository.guardar(orden)

    def obtener_orden(self, orden_id: int) -> Orden_Reposicion:
        """Obtiene una orden de reposicion por su identificador."""
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_Invalida_Exception(
                f"No se encontro la orden de reposicion con ID {orden_id}."
            )
        return orden

    def listar_ordenes(self, estado: str | None = None) -> list[Orden_Reposicion]:
        """Lista todas las ordenes o filtradas por estado."""
        if estado:
            return self._orden_repository.listar_por_estado(estado)
        return self._orden_repository.listar_todas()
