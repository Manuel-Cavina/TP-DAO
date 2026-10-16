from collections.abc import Callable
from typing import Any

from config.database import sqlite_connection
from modules.logistica.application.stock_service_contract import (
    Mock_Stock_Service,
    Stock_Service_Contract,
)
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.exceptions import (
    Orden_Invalida_Exception,
    Remito_Incompleto_Exception,
)
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure import (
    Bulto_Repository,
    Orden_Reposicion_Repository,
    Remito_Repository,
)


class Recepcion_Service:
    """Caso de uso para recepcion, verificacion fisica de precintos y cierre de remito con impacto en stock (P6, V1)."""

    def __init__(
        self,
        remito_repository: Remito_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        stock_service: Stock_Service_Contract | None = None,
        connection_factory: Callable[[], Any] | None = None,
    ) -> None:
        self._bulto_repository = (
            bulto_repository if bulto_repository is not None else Bulto_Repository()
        )
        self._remito_repository = (
            remito_repository
            if remito_repository is not None
            else Remito_Repository(self._bulto_repository)
        )
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._stock_service = stock_service if stock_service is not None else Mock_Stock_Service()
        self._connection_factory = connection_factory or sqlite_connection

    def recibir_remito(self, remito_numero: str) -> Remito:
        """Registra la llegada de mercaderia en la sucursal y pasa los bultos a RECIBIDO."""
        with self._connection_factory() as conn:
            remito = self._remito_repository.obtener_por_numero(conn, remito_numero)
            if remito is None:
                raise Remito_Incompleto_Exception(
                    f"No se encontro el remito con numero '{remito_numero}'."
                )

            remito.recibir()
            for b in remito.bultos:
                self._bulto_repository.actualizar(conn, b, remito.numero)

            return remito

    def verificar_bulto(
        self, bulto_id: int | str, codigo_precinto_recibido: str, esta_intacto: bool
    ) -> Bulto:
        """Verifica fisicamente el precinto de un bulto recibido transicionando a VERIFICADO o RECHAZADO."""
        with self._connection_factory() as conn:
            bulto = self._bulto_repository.obtener_por_id(conn, bulto_id)
            if bulto is None:
                raise Orden_Invalida_Exception(f"No se encontro el bulto con ID {bulto_id}.")

            bulto.verificar(codigo_precinto_recibido, esta_intacto)
            self._bulto_repository.actualizar(conn, bulto)
            return bulto

    def cerrar_remito(self, remito_numero: str) -> dict[str, Any]:
        """Cierra el remito tras verificar todos los bultos e impacta stock vendible o merma (V1)."""
        with self._connection_factory() as conn:
            remito = self._remito_repository.obtener_por_numero(conn, remito_numero)
            if remito is None:
                raise Remito_Incompleto_Exception(
                    f"No se encontro el remito con numero '{remito_numero}'."
                )

            # Valida que todos los bultos esten VERIFICADO o RECHAZADO y pasa remito a CERRADO
            remito.cerrar()
            self._remito_repository.actualizar(conn, remito)

            unidades_acreditadas = 0
            unidades_merma = 0
            bultos_verificados = 0
            bultos_rechazados = 0

            # V1: Impacto en stock segun verificacion de cada bulto
            for bulto in remito.bultos:
                if bulto.estado.nombre == "VERIFICADO":
                    bultos_verificados += 1
                    for det in bulto.detalles:
                        self._stock_service.acreditar_verificado(
                            conn, det.producto_id, remito.destino_id, det.cantidad
                        )
                        unidades_acreditadas += det.cantidad
                elif bulto.estado.nombre == "RECHAZADO":
                    bultos_rechazados += 1
                    for det in bulto.detalles:
                        self._stock_service.registrar_merma(
                            conn, det.producto_id, remito.destino_id, det.cantidad
                        )
                        unidades_merma += det.cantidad

            # Intentar cerrar la orden asociada si corresponde
            if remito.bultos:
                orden_id = remito.bultos[0].orden_id
                orden = self._orden_repository.obtener_por_id(conn, orden_id)
                if orden is not None and orden.estado == "DESPACHADA":
                    orden.cerrar()
                    self._orden_repository.actualizar(conn, orden)

            return {
                "remito_numero": remito.numero,
                "estado": remito.estado,
                "bultos_verificados": bultos_verificados,
                "bultos_rechazados": bultos_rechazados,
                "unidades_acreditadas": unidades_acreditadas,
                "unidades_merma": unidades_merma,
            }
