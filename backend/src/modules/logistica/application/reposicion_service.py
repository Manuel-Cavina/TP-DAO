from collections import defaultdict
from collections.abc import Callable
import sqlite3
from typing import Any

from config.database import sqlite_connection
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
        connection_factory: Callable[[], Any] | None = None,
    ) -> None:
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._necesidad_repository = (
            necesidad_repository
            if necesidad_repository is not None
            else Necesidad_Reposicion_Repository()
        )
        self._connection_factory = connection_factory or sqlite_connection

    def registrar_necesidad(
        self,
        producto_id: str,
        local_id: str,
        cantidad: int,
        connection: sqlite3.Connection | None = None,
    ) -> int | None:
        """Contrato oficial usado por el Observer de Stock y cargas manuales."""
        if connection is not None:
            return self._necesidad_repository.registrar(
                connection, producto_id, local_id, cantidad
            )

        with self._connection_factory() as conn:
            return self._necesidad_repository.registrar(
                conn, producto_id, local_id, cantidad
            )

    def listar_necesidades_pendientes(
        self, local_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Lista las necesidades pendientes generadas para un local o todos."""
        with self._connection_factory() as conn:
            return self._necesidad_repository.listar_pendientes(conn, local_id)

    def consolidar_necesidades_en_orden(
        self, local_destino_id: str, origen_id: str = "CD-CENTRAL"
    ) -> Orden_Reposicion:
        """Consolida las necesidades pendientes de un local en una Orden_Reposicion (P3)."""
        with self._connection_factory() as conn:
            pendientes = self._necesidad_repository.listar_pendientes(
                conn, local_destino_id
            )
            if not pendientes:
                raise Orden_Invalida_Exception(
                    f"No existen necesidades pendientes para consolidar hacia el local '{local_destino_id}'."
                )

            acumulados: dict[str, int] = defaultdict(int)
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
            orden_guardada = self._orden_repository.guardar(conn, orden)
            self._necesidad_repository.consolidar_en_orden(
                conn, necesidad_ids, orden_guardada.id or 0
            )

            return orden_guardada

    def crear_orden_manual(
        self, origen_id: str, destino_id: str, items: list[dict[str, Any]]
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

        with self._connection_factory() as conn:
            return self._orden_repository.guardar(conn, orden)

    def obtener_orden(self, orden_id: int | str) -> Orden_Reposicion:
        """Obtiene una orden de reposicion por su identificador."""
        with self._connection_factory() as conn:
            orden = self._orden_repository.obtener_por_id(conn, orden_id)
            if orden is None:
                raise Orden_Invalida_Exception(
                    f"No se encontro la orden de reposicion con ID {orden_id}."
                )
            return orden

    def listar_ordenes(self, estado: str | None = None) -> list[Orden_Reposicion]:
        """Lista todas las ordenes o filtradas por estado."""
        with self._connection_factory() as conn:
            if estado:
                return self._orden_repository.listar_por_estado(conn, estado)
            return self._orden_repository.listar_todas(conn)
