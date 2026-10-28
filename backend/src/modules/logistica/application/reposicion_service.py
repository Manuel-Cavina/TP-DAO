from collections import defaultdict
from typing import Any

from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.logistica.application.trazabilidad_service import Trazabilidad_Service
from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.evento_trazabilidad import Evento_Trazabilidad
from modules.logistica.domain.exceptions import Orden_Invalida_Exception, Orden_No_Encontrada_Exception
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.infrastructure.necesidad_reposicion_repository import Necesidad_Reposicion_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository


class Reposicion_Service:
    """Caso de uso para la gestion y consolidacion de necesidades en ordenes de reposicion (P3/US3)."""

    def __init__(
        self,
        stock_service: Stock_Service_Contract,
        orden_repository: Orden_Reposicion_Repository | None = None,
        necesidad_repository: Necesidad_Reposicion_Repository | None = None,
        trazabilidad_service: Trazabilidad_Service | None = None,
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
        self._trazabilidad_service = (
            trazabilidad_service
            if trazabilidad_service is not None
            else Trazabilidad_Service()
        )

    def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> int | None:
        """Contrato oficial usado por el Observer de Stock y cargas manuales."""
        if cantidad <= 0:
            raise Orden_Invalida_Exception("La cantidad de la necesidad debe ser mayor a cero.")
        self._stock_service.validar_producto(producto_id)
        self._stock_service.validar_local(local_id)
        return self._necesidad_repository.registrar(producto_id, local_id, cantidad)

    def listar_necesidades_pendientes(self, local_id: int | None = None) -> list[dict[str, Any]]:
        """Lista las necesidades pendientes generadas para un local o todos."""
        return self._necesidad_repository.listar_pendientes(local_id)

    def consolidar_necesidades_en_orden(
        self,
        local_destino_id: int,
        origen_id: int,
        necesidad_ids: list[int] | None = None,
        validar_stock: bool = False,
        actor: str | None = None,
    ) -> Orden_Reposicion:
        """Consolida las necesidades pendientes de un local en una Orden_Reposicion (P3/US3)."""
        self._validar_ruta(origen_id, local_destino_id)
        pendientes = self._obtener_necesidades_a_consolidar(local_destino_id, necesidad_ids)
        acumulados, final_ids = self._acumular_cantidades(pendientes)

        if validar_stock:
            self._validar_stock_disponible(origen_id, acumulados)

        orden = Orden_Reposicion(
            origen_id=origen_id,
            destino_id=local_destino_id,
            detalles=[Detalle_Orden_Reposicion(prod, cant) for prod, cant in acumulados.items()],
        )
        orden_guardada = self._orden_repository.guardar(orden)
        self._necesidad_repository.consolidar_en_orden(final_ids, orden_guardada.id)
        self._registrar_evento_creacion(orden_guardada, "CONSOLIDAR_ORDEN", final_ids, actor)
        return orden_guardada

    def crear_orden_manual(
        self,
        origen_id: int,
        destino_id: int,
        items: list[dict[str, Any]],
        necesidad_ids: list[int] | None = None,
        validar_stock: bool = False,
        actor: str | None = None,
    ) -> Orden_Reposicion:
        """Permite cargar una orden de reposicion de forma manual validando precondiciones."""
        self._validar_items_manuales(items)
        self._validar_ruta(origen_id, destino_id)
        for it in items:
            self._stock_service.validar_producto(it["producto_id"])

        if validar_stock:
            cantidades = {it["producto_id"]: it["cantidad"] for it in items}
            self._validar_stock_disponible(origen_id, cantidades)

        if necesidad_ids:
            self._validar_necesidades_destino(necesidad_ids, destino_id)

        orden = Orden_Reposicion(
            origen_id=origen_id,
            destino_id=destino_id,
            detalles=[Detalle_Orden_Reposicion(it["producto_id"], it["cantidad"]) for it in items],
        )
        orden_guardada = self._orden_repository.guardar(orden)
        if necesidad_ids:
            self._necesidad_repository.consolidar_en_orden(necesidad_ids, orden_guardada.id)

        self._registrar_evento_creacion(orden_guardada, "CREAR_ORDEN", necesidad_ids, actor)
        return orden_guardada

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
        if origen_id == destino_id:
            raise Orden_Invalida_Exception("El origen y destino de la orden no pueden ser iguales.")
        self._stock_service.validar_centro_distribucion(origen_id)
        self._stock_service.validar_local(destino_id)

    def _validar_items_manuales(self, items: list[dict[str, Any]]) -> None:
        """Valida que los renglones sean validos, sin duplicados ni cantidades <= 0."""
        if not items:
            raise Orden_Invalida_Exception("La orden debe contener al menos un producto.")
        productos_vistos: set[int] = set()
        for it in items:
            prod_id = it.get("producto_id")
            cant = it.get("cantidad", 0)
            if not isinstance(prod_id, int) or isinstance(prod_id, bool) or prod_id <= 0:
                raise Orden_Invalida_Exception("El producto debe ser un identificador entero positivo.")
            if prod_id in productos_vistos:
                raise Orden_Invalida_Exception(f"Producto duplicado en los ítems de la orden: {prod_id}.")
            productos_vistos.add(prod_id)
            if not isinstance(cant, int) or isinstance(cant, bool) or cant <= 0:
                raise Orden_Invalida_Exception("La cantidad solicitada debe ser mayor a cero.")

    def _obtener_necesidades_a_consolidar(
        self, local_destino_id: int, necesidad_ids: list[int] | None
    ) -> list[dict[str, Any]]:
        """Recupera y valida las necesidades seleccionadas o pendientes."""
        if necesidad_ids is not None:
            if not necesidad_ids:
                raise Orden_Invalida_Exception("Debe especificar al menos una necesidad para consolidar.")
            return self._validar_necesidades_destino(necesidad_ids, local_destino_id)

        pendientes = self._necesidad_repository.listar_pendientes(local_destino_id)
        if not pendientes:
            raise Orden_Invalida_Exception(
                f"No existen necesidades pendientes para consolidar hacia el local '{local_destino_id}'."
            )
        return pendientes

    def _validar_necesidades_destino(
        self, necesidad_ids: list[int], local_destino_id: int
    ) -> list[dict[str, Any]]:
        """Rechaza si hay IDs duplicados, inexistentes, no pendientes o con destinos mixtos."""
        if len(set(necesidad_ids)) != len(necesidad_ids):
            raise Orden_Invalida_Exception("Existen identificadores de necesidades duplicados.")
        necesidades = self._necesidad_repository.obtener_por_ids(necesidad_ids)
        if len(necesidades) != len(necesidad_ids):
            raise Orden_Invalida_Exception("Una o más necesidades especificadas no existen.")
        for nec in necesidades:
            if nec["estado"] != "PENDIENTE":
                raise Orden_Invalida_Exception(f"La necesidad {nec['id']} no está en estado PENDIENTE.")
            if nec["local_id"] != local_destino_id:
                raise Orden_Invalida_Exception(
                    f"No se pueden consolidar necesidades de distintos destinos: la necesidad {nec['id']} "
                    f"pertenece al local {nec['local_id']} y el destino es {local_destino_id}."
                )
        return necesidades

    def _acumular_cantidades(
        self, pendientes: list[dict[str, Any]]
    ) -> tuple[dict[int, int], list[int]]:
        """Agrupa renglones por producto y valida su estado en el catálogo."""
        acumulados: dict[int, int] = defaultdict(int)
        necesidad_ids: list[int] = []
        for p in pendientes:
            self._stock_service.validar_producto(p["producto_id"])
            acumulados[p["producto_id"]] += p["cantidad"]
            necesidad_ids.append(p["id"])
        return dict(acumulados), necesidad_ids

    def _validar_stock_disponible(self, origen_id: int, cantidades: dict[int, int]) -> None:
        """Verifica que el Centro de Distribución cuente con existencias para cada renglón."""
        for prod_id, cant in cantidades.items():
            self._stock_service.validar_stock_disponible(prod_id, origen_id, cant)

    def _registrar_evento_creacion(
        self,
        orden: Orden_Reposicion,
        accion: str,
        necesidad_ids: list[int] | None,
        actor: str | None,
    ) -> None:
        """Registra un evento inmutable de trazabilidad al crear o consolidar la orden."""
        reg_asoc = f"necesidades: {', '.join(str(nid) for nid in necesidad_ids)}" if necesidad_ids else None
        evento = Evento_Trazabilidad(
            tipo_entidad="ORDEN",
            entidad_id=orden.id,
            accion=accion,
            estado_anterior=None,
            estado_nuevo=orden.estado,
            actor=actor,
            origen_id=orden.origen_id,
            destino_id=orden.destino_id,
            registros_asociados=reg_asoc,
            motivo_o_evidencia=f"Emisión de orden de reposición #{orden.id}",
        )
        self._trazabilidad_service.registrar_evento(evento)
