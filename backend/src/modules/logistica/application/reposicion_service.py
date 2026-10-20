from collections import defaultdict
from typing import Any

from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.exceptions import Orden_Invalida_Exception, Orden_No_Encontrada_Exception
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.infrastructure.necesidad_reposicion_repository import Necesidad_Reposicion_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository


class Reposicion_Service:
    """Caso de uso para la gestion y consolidacion de necesidades en ordenes de reposicion (P3)."""

    def __init__(
        self,
        stock_service: Stock_Service_Contract,
        orden_repository: Orden_Reposicion_Repository | None = None,
        necesidad_repository: Necesidad_Reposicion_Repository | None = None,
    ) -> None:
        self._stock_service = stock_service
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._necesidad_repository = (
            necesidad_repository
            if necesidad_repository is not None
            else Necesidad_Reposicion_Repository()
        )

    def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> int | None:
        """Contrato oficial usado por el Observer de Stock y cargas manuales.

        Devuelve None si ya habia una necesidad pendiente del producto en el local.
        """
        if cantidad <= 0:
            raise Orden_Invalida_Exception("La cantidad de la necesidad debe ser mayor a cero.")
        self._stock_service.validar_producto(producto_id)
        self._stock_service.validar_local(local_id)
        return self._necesidad_repository.registrar(producto_id, local_id, cantidad)

    def listar_necesidades_pendientes(self, local_id: int | None = None) -> list[dict[str, Any]]:
        """Lista las necesidades pendientes generadas para un local o todos."""
        return self._necesidad_repository.listar_pendientes(local_id)

    def consolidar_necesidades_en_orden(self, local_destino_id: int, origen_id: int) -> Orden_Reposicion:
        """Consolida las necesidades pendientes de un local en una Orden_Reposicion (P3)."""
        self._validar_ruta(origen_id, local_destino_id)
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

        orden = Orden_Reposicion(
            origen_id=origen_id,
            destino_id=local_destino_id,
            detalles=[Detalle_Orden_Reposicion(prod, cant) for prod, cant in acumulados.items()],
        )
        orden_guardada = self._orden_repository.guardar(orden)
        self._necesidad_repository.consolidar_en_orden(necesidad_ids, orden_guardada.id)
        return orden_guardada

    def crear_orden_manual(self, origen_id: int, destino_id: int, items: list[dict[str, Any]]) -> Orden_Reposicion:
        """Permite cargar una orden de reposicion de forma manual."""
        if not items:
            raise Orden_Invalida_Exception("La orden debe contener al menos un producto.")
        self._validar_ruta(origen_id, destino_id)
        for it in items:
            self._stock_service.validar_producto(it["producto_id"])

        orden = Orden_Reposicion(
            origen_id=origen_id,
            destino_id=destino_id,
            detalles=[Detalle_Orden_Reposicion(it["producto_id"], it["cantidad"]) for it in items],
        )
        return self._orden_repository.guardar(orden)

    def obtener_orden(self, orden_id: int) -> Orden_Reposicion:
        """Obtiene una orden de reposicion por su identificador."""
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_No_Encontrada_Exception(f"No se encontro la orden de reposicion con ID {orden_id}.")
        return orden

    def listar_ordenes(self, estado: str | None = None) -> list[Orden_Reposicion]:
        """Lista todas las ordenes o filtradas por estado."""
        if estado:
            return self._orden_repository.listar_por_estado(estado)
        return self._orden_repository.listar_todas()

    def _validar_ruta(self, origen_id: int, destino_id: int) -> None:
        """La reposicion siempre va de un Centro de Distribucion a un local."""
        self._stock_service.validar_centro_distribucion(origen_id)
        self._stock_service.validar_local(destino_id)
