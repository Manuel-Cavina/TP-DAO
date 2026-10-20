from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.logistica.domain.exceptions import Remito_No_Encontrado_Exception
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository

_ESTADOS_SIN_DESPACHAR = ("PREPARADO", "PRECINTADO")


class Despacho_Service:
    """Caso de uso para despachar remitos completos y registrar stock en transito (P5)."""

    def __init__(
        self,
        stock_service: Stock_Service_Contract,
        remito_repository: Remito_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
    ) -> None:
        self._stock_service = stock_service
        self._bulto_repository = bulto_repository if bulto_repository is not None else Bulto_Repository()
        self._remito_repository = (
            remito_repository if remito_repository is not None else Remito_Repository(self._bulto_repository)
        )
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )

    def despachar_remito(self, remito_numero: str) -> Remito:
        """Despacha el remito completo, bultos a EN_TRANSITO y registra transito en destino."""
        remito = self.obtener_remito(remito_numero)
        remito.despachar()
        self._remito_repository.actualizar(remito)

        for bulto in remito.bultos:
            self._bulto_repository.actualizar(bulto, remito.numero)
            for det in bulto.detalles:
                self._stock_service.registrar_en_transito(det.producto_id, remito.destino_id, det.cantidad)

        self._despachar_orden_si_corresponde(remito.bultos[0].orden_id)
        return remito

    def obtener_remito(self, remito_numero: str) -> Remito:
        """Obtiene un remito por su numero."""
        remito = self._remito_repository.obtener_por_numero(remito_numero)
        if remito is None:
            raise Remito_No_Encontrado_Exception(f"No se encontro el remito con numero '{remito_numero}'.")
        return remito

    def listar_remitos(self) -> list[Remito]:
        """Devuelve todos los remitos emitidos en el sistema."""
        return self._remito_repository.listar_todos()

    def _despachar_orden_si_corresponde(self, orden_id: int) -> None:
        """La orden queda DESPACHADA recien cuando se empaqueto todo y ningun bulto sigue en el CD."""
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None or orden.estado != "EN_PREPARACION" or not orden.esta_completamente_enviada:
            return
        bultos = self._bulto_repository.listar_por_orden(orden_id)
        if any(b.estado.nombre in _ESTADOS_SIN_DESPACHAR for b in bultos):
            return
        orden.despachar()
        self._orden_repository.actualizar(orden)
