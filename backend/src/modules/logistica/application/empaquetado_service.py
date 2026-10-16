from typing import Any

from modules.logistica.application.stock_service_contract import (
    Mock_Stock_Service,
    Stock_Service_Contract,
)
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.exceptions import (
    Bulto_Vacio_Exception,
    Orden_Invalida_Exception,
    Precinto_Invalido_Exception,
    Remito_Incompleto_Exception,
)
from modules.logistica.domain.precinto import Precinto
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure import (
    Bulto_Repository,
    Orden_Reposicion_Repository,
    Precinto_Repository,
    Remito_Repository,
)


class Empaquetado_Service:
    """Caso de uso para empaquetado de mercaderia, asignacion de precintos y emision de remitos (P4)."""

    def __init__(
        self,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        precinto_repository: Precinto_Repository | None = None,
        remito_repository: Remito_Repository | None = None,
        stock_service: Stock_Service_Contract | None = None,
    ) -> None:
        self._bulto_repository = (
            bulto_repository if bulto_repository is not None else Bulto_Repository()
        )
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._precinto_repository = (
            precinto_repository if precinto_repository is not None else Precinto_Repository()
        )
        self._remito_repository = (
            remito_repository
            if remito_repository is not None
            else Remito_Repository(self._bulto_repository)
        )
        self._stock_service = stock_service if stock_service is not None else Mock_Stock_Service()

    def registrar_precinto(self, codigo: str) -> Precinto:
        """Da de alta un precinto nuevo en la base de datos."""
        precinto = Precinto(codigo=codigo, esta_intacto=True)
        existente = self._precinto_repository.obtener_por_codigo(codigo)
        if existente is not None:
            raise Precinto_Invalido_Exception(f"El precinto '{codigo}' ya esta registrado.")
        self._precinto_repository.guardar(precinto)
        return precinto

    def crear_bulto(
        self, orden_id: int | str, items: list[dict[str, Any]]
    ) -> Bulto:
        """Arma un bulto en preparacion reservando el stock del Centro de Distribucion."""
        if not items:
            raise Bulto_Vacio_Exception("No se puede armar un bulto sin items.")

        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_Invalida_Exception(f"No se encontro la orden {orden_id}.")

        if orden.estado == "PENDIENTE":
            orden.iniciar_preparacion()

        if orden.estado != "EN_PREPARACION":
            raise Orden_Invalida_Exception(
                f"No se pueden armar bultos para una orden en estado '{orden.estado}'."
            )

        detalles_bulto: list[Detalle_Bulto] = []
        for item in items:
            prod_id = item["producto_id"]
            cant = item["cantidad"]

            detalle_orden = next(
                (d for d in orden.detalles if d.producto_id == prod_id), None
            )
            if detalle_orden is None:
                raise Orden_Invalida_Exception(
                    f"El producto '{prod_id}' no forma parte de la orden de reposicion."
                )

            detalle_orden.registrar_envio(cant)

            # Contrato con Integrante 1: descontar disponible del CD (sin session ni connection)
            self._stock_service.reservar_para_despacho(prod_id, orden.origen_id, cant)
            detalles_bulto.append(Detalle_Bulto(producto_id=prod_id, cantidad=cant))

        bulto = Bulto(orden_id=orden_id, detalles=detalles_bulto)
        bulto_guardado = self._bulto_repository.guardar(bulto)
        self._orden_repository.actualizar(orden)

        return bulto_guardado

    def precintar_bulto(self, bulto_id: int | str, codigo_precinto: str) -> Bulto:
        """Asigna un precinto valido al bulto y transiciona a PRECINTADO."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Orden_Invalida_Exception(f"No se encontro el bulto con ID {bulto_id}.")

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

    def generar_remito(
        self, numero: str, orden_id: int | str, bultos_ids: list[int | str]
    ) -> Remito:
        """Genera un remito agrupando bultos precintados de una orden."""
        if not bultos_ids:
            raise Remito_Incompleto_Exception("El remito debe incluir al menos un bulto.")

        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_Invalida_Exception(f"No se encontro la orden {orden_id}.")

        bultos: list[Bulto] = []
        for bid in bultos_ids:
            b = self._bulto_repository.obtener_por_id(bid)
            if b is None:
                raise Remito_Incompleto_Exception(f"No se encontro el bulto {bid}.")
            if str(b.orden_id) != str(orden_id):
                raise Remito_Incompleto_Exception(
                    f"El bulto {bid} no pertenece a la orden {orden_id}."
                )
            if b.estado.nombre != "PRECINTADO":
                raise Remito_Incompleto_Exception(
                    f"El bulto {bid} esta en estado '{b.estado.nombre}', debe estar PRECINTADO."
                )
            bultos.append(b)

        remito = Remito(
            numero=numero,
            origen_id=orden.origen_id,
            destino_id=orden.destino_id,
            bultos=bultos,
        )
        return self._remito_repository.guardar(remito)

    def obtener_bulto(self, bulto_id: int | str) -> Bulto:
        """Obtiene un bulto por su identificador."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Orden_Invalida_Exception(f"No se encontro el bulto con ID {bulto_id}.")
        return bulto

    def listar_bultos_por_orden(self, orden_id: int | str) -> list[Bulto]:
        """Lista los bultos pertenecientes a una orden."""
        return self._bulto_repository.listar_por_orden(orden_id)
