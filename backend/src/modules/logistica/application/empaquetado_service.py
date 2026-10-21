from typing import Any

from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.exceptions import (
    Bulto_Invalido_Exception,
    Bulto_No_Encontrado_Exception,
    Bulto_Vacio_Exception,
    Orden_Invalida_Exception,
    Orden_No_Encontrada_Exception,
    Precinto_Duplicado_Exception,
    Precinto_Invalido_Exception,
    Remito_Duplicado_Exception,
    Remito_Incompleto_Exception,
)
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.domain.precinto import Precinto
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository
from modules.logistica.infrastructure.precinto_repository import Precinto_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository


class Empaquetado_Service:
    """Caso de uso para empaquetado de mercaderia, asignacion de precintos y emision de remitos (P4)."""

    def __init__(
        self,
        stock_service: Stock_Service_Contract,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        precinto_repository: Precinto_Repository | None = None,
        remito_repository: Remito_Repository | None = None,
    ) -> None:
        self._stock_service = stock_service
        self._bulto_repository = bulto_repository if bulto_repository is not None else Bulto_Repository()
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._precinto_repository = (
            precinto_repository if precinto_repository is not None else Precinto_Repository()
        )
        self._remito_repository = (
            remito_repository if remito_repository is not None else Remito_Repository(self._bulto_repository)
        )

    def registrar_precinto(self, codigo: str) -> Precinto:
        """Da de alta un precinto nuevo en la base de datos."""
        precinto = Precinto(codigo=codigo, esta_intacto=True)
        if self._precinto_repository.obtener_por_codigo(precinto.codigo) is not None:
            raise Precinto_Duplicado_Exception(f"El precinto '{precinto.codigo}' ya esta registrado.")
        self._precinto_repository.guardar(precinto)
        return precinto

    def crear_bulto(self, orden_id: int, items: list[dict[str, Any]]) -> Bulto:
        """Arma un bulto en preparacion reservando el stock del Centro de Distribucion."""
        if not items:
            raise Bulto_Vacio_Exception("No se puede armar un bulto sin items.")
        productos = [item["producto_id"] for item in items]
        if len(set(productos)) != len(productos):
            raise Bulto_Invalido_Exception("Un producto no puede aparecer dos veces en el mismo bulto.")

        orden = self._obtener_orden(orden_id)
        if orden.estado == "PENDIENTE":
            orden.iniciar_preparacion()
        if orden.estado != "EN_PREPARACION":
            raise Orden_Invalida_Exception(
                f"No se pueden armar bultos para una orden en estado '{orden.estado}'."
            )

        detalles_bulto: list[Detalle_Bulto] = []
        for item in items:
            producto_id, cantidad = item["producto_id"], item["cantidad"]
            detalle_orden = orden.buscar_detalle(producto_id)
            if detalle_orden is None:
                raise Orden_Invalida_Exception(
                    f"El producto '{producto_id}' no forma parte de la orden de reposicion."
                )
            detalle_orden.registrar_envio(cantidad)
            self._stock_service.reservar_para_despacho(producto_id, orden.origen_id, cantidad)
            detalles_bulto.append(Detalle_Bulto(producto_id=producto_id, cantidad=cantidad))

        bulto = self._bulto_repository.guardar(Bulto(orden_id=orden_id, detalles=detalles_bulto))
        self._orden_repository.actualizar(orden)
        return bulto

    def precintar_bulto(self, bulto_id: int, codigo_precinto: str) -> Bulto:
        """Asigna un precinto valido al bulto y transiciona a PRECINTADO."""
        bulto = self.obtener_bulto(bulto_id)
        if not self._precinto_repository.esta_disponible(codigo_precinto):
            raise Precinto_Invalido_Exception(
                f"El precinto '{codigo_precinto}' no existe, no esta disponible o ya fue utilizado."
            )
        precinto = self._precinto_repository.obtener_por_codigo(codigo_precinto)
        if precinto is None:
            raise Precinto_Invalido_Exception(f"Precinto '{codigo_precinto}' inexistente.")

        bulto.precintar(precinto)
        self._bulto_repository.actualizar(bulto)
        self._precinto_repository.marcar_utilizado(codigo_precinto)
        return bulto

    def generar_remito(self, numero: str, orden_id: int, bultos_ids: list[int]) -> Remito:
        """Genera un remito agrupando bultos precintados de una orden que no esten en otro remito."""
        if not bultos_ids:
            raise Remito_Incompleto_Exception("El remito debe incluir al menos un bulto.")
        if len(set(bultos_ids)) != len(bultos_ids):
            raise Remito_Incompleto_Exception("El remito no puede incluir el mismo bulto dos veces.")

        orden = self._obtener_orden(orden_id)
        if self._remito_repository.existe(numero):
            raise Remito_Duplicado_Exception(f"Ya existe un remito con numero '{numero.strip()}'.")

        bultos = [self._bulto_para_remito(bid, orden_id) for bid in bultos_ids]
        remito = Remito(numero=numero, origen_id=orden.origen_id, destino_id=orden.destino_id, bultos=bultos)
        return self._remito_repository.guardar(remito)

    def obtener_bulto(self, bulto_id: int) -> Bulto:
        """Obtiene un bulto por su identificador."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")
        return bulto

    def listar_bultos_por_orden(self, orden_id: int) -> list[Bulto]:
        """Lista los bultos pertenecientes a una orden."""
        self._obtener_orden(orden_id)
        return self._bulto_repository.listar_por_orden(orden_id)

    def _obtener_orden(self, orden_id: int) -> Orden_Reposicion:
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_No_Encontrada_Exception(f"No se encontro la orden {orden_id}.")
        return orden

    def _bulto_para_remito(self, bulto_id: int, orden_id: int) -> Bulto:
        bulto = self.obtener_bulto(bulto_id)
        if bulto.orden_id != orden_id:
            raise Remito_Incompleto_Exception(f"El bulto {bulto_id} no pertenece a la orden {orden_id}.")
        remito_actual = self._bulto_repository.remito_asignado(bulto_id)
        if remito_actual is not None:
            raise Remito_Incompleto_Exception(
                f"El bulto {bulto_id} ya forma parte del remito '{remito_actual}'."
            )
        if bulto.estado.nombre != "PRECINTADO":
            raise Remito_Incompleto_Exception(
                f"El bulto {bulto_id} esta en estado '{bulto.estado.nombre}', debe estar PRECINTADO."
            )
        return bulto
