from typing import Any

from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.exceptions import (
    Bulto_No_Encontrado_Exception,
    Remito_No_Encontrado_Exception,
)
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository
from modules.logistica.infrastructure.precinto_repository import Precinto_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository


class Recepcion_Service:
    """Caso de uso para recepcion, verificacion fisica de precintos y cierre de remito con impacto en stock (P6, V1)."""

    def __init__(
        self,
        stock_service: Stock_Service_Contract,
        remito_repository: Remito_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        precinto_repository: Precinto_Repository | None = None,
    ) -> None:
        self._stock_service = stock_service
        self._bulto_repository = bulto_repository if bulto_repository is not None else Bulto_Repository()
        self._remito_repository = (
            remito_repository if remito_repository is not None else Remito_Repository(self._bulto_repository)
        )
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._precinto_repository = (
            precinto_repository if precinto_repository is not None else Precinto_Repository()
        )

    def recibir_remito(self, remito_numero: str) -> Remito:
        """Registra la llegada de mercaderia en la sucursal y pasa los bultos a RECIBIDO."""
        remito = self._obtener_remito(remito_numero)
        remito.recibir()
        for b in remito.bultos:
            self._bulto_repository.actualizar(b, remito.numero)
        return remito

    def verificar_bulto(self, bulto_id: int, codigo_precinto_recibido: str, esta_intacto: bool) -> Bulto:
        """Verifica fisicamente el precinto de un bulto recibido transicionando a VERIFICADO o RECHAZADO."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")

        bulto.verificar(codigo_precinto_recibido, esta_intacto)
        self._bulto_repository.actualizar(bulto)
        precinto = bulto.precinto
        if not esta_intacto and precinto is not None and precinto.codigo == codigo_precinto_recibido.strip():
            # El precinto registrado llego violado: queda como evidencia para el reporte de mermas.
            # Si el codigo no coincide, el precinto fisico es otro y no se altera el registrado.
            precinto.romper()
            self._precinto_repository.actualizar(precinto)
        return bulto

    def cerrar_remito(self, remito_numero: str) -> dict[str, Any]:
        """Cierra el remito tras verificar todos los bultos e impacta stock vendible o merma (V1)."""
        remito = self._obtener_remito(remito_numero)
        remito.cerrar()
        self._remito_repository.actualizar(remito)

        unidades_acreditadas = unidades_merma = bultos_verificados = bultos_rechazados = 0
        for bulto in remito.bultos:
            if bulto.estado.nombre == "VERIFICADO":
                bultos_verificados += 1
                for det in bulto.detalles:
                    self._stock_service.acreditar_verificado(det.producto_id, remito.destino_id, det.cantidad)
                    unidades_acreditadas += det.cantidad
            else:
                bultos_rechazados += 1
                for det in bulto.detalles:
                    self._stock_service.registrar_merma(det.producto_id, remito.destino_id, det.cantidad)
                    unidades_merma += det.cantidad

        self._cerrar_orden_si_corresponde(remito.bultos[0].orden_id)
        return {
            "remito_numero": remito.numero,
            "estado": remito.estado,
            "bultos_verificados": bultos_verificados,
            "bultos_rechazados": bultos_rechazados,
            "unidades_acreditadas": unidades_acreditadas,
            "unidades_merma": unidades_merma,
        }

    def _obtener_remito(self, remito_numero: str) -> Remito:
        remito = self._remito_repository.obtener_por_numero(remito_numero)
        if remito is None:
            raise Remito_No_Encontrado_Exception(f"No se encontro el remito con numero '{remito_numero}'.")
        return remito

    def _cerrar_orden_si_corresponde(self, orden_id: int) -> None:
        """La orden se cierra cuando ya fue despachada y todos los remitos de sus bultos estan cerrados."""
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None or orden.estado != "DESPACHADA":
            return
        bultos = self._bulto_repository.listar_por_orden(orden_id)
        remitos = {self._bulto_repository.remito_asignado(b.id) for b in bultos}
        if None in remitos or any(self._remito_repository.estado(n) != "CERRADO" for n in remitos):
            return
        orden.cerrar()
        self._orden_repository.actualizar(orden)
