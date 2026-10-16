from modules.logistica.application.stock_service_contract import (
    Mock_Stock_Service,
    Stock_Service_Contract,
)
from modules.logistica.domain.exceptions import Remito_Incompleto_Exception
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure import (
    Bulto_Repository,
    Orden_Reposicion_Repository,
    Remito_Repository,
)


class Despacho_Service:
    """Caso de uso para despachar remitos completos y registrar stock en transito (P5)."""

    def __init__(
        self,
        remito_repository: Remito_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        stock_service: Stock_Service_Contract | None = None,
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

    def despachar_remito(self, remito_numero: str) -> Remito:
        """Despacha el remito completo, bultos a EN_TRANSITO y registra transito en destino."""
        remito = self._remito_repository.obtener_por_numero(remito_numero)
        if remito is None:
            raise Remito_Incompleto_Exception(
                f"No se encontro el remito con numero '{remito_numero}'."
            )

        remito.despachar()
        self._remito_repository.actualizar(remito)

        for bulto in remito.bultos:
            self._bulto_repository.actualizar(bulto, remito.numero)
            for det in bulto.detalles:
                # Contrato con Integrante 1: suma mercaderia a cantidad_en_transito en destino
                self._stock_service.registrar_en_transito(
                    det.producto_id, remito.destino_id, det.cantidad
                )

        if remito.bultos:
            orden_id = remito.bultos[0].orden_id
            orden = self._orden_repository.obtener_por_id(orden_id)
            if orden is not None and orden.estado == "EN_PREPARACION":
                orden.despachar()
                self._orden_repository.actualizar(orden)

        return remito

    def obtener_remito(self, remito_numero: str) -> Remito:
        """Obtiene un remito por su numero."""
        remito = self._remito_repository.obtener_por_numero(remito_numero)
        if remito is None:
            raise Remito_Incompleto_Exception(
                f"No se encontro el remito con numero '{remito_numero}'."
            )
        return remito

    def listar_remitos(self) -> list[Remito]:
        """Devuelve todos los remitos emitidos en el sistema."""
        return self._remito_repository.listar_todos()
