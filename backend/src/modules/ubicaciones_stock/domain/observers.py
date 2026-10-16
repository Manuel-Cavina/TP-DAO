from abc import ABC, abstractmethod
from datetime import datetime
from typing import TYPE_CHECKING, Any, Protocol

from modules.ubicaciones_stock.domain.alerta_stock import Alerta_Stock

if TYPE_CHECKING:
    from modules.ubicaciones_stock.domain.stock import Stock


class Stock_Observer(ABC):
    """Contrato base para observadores del patrón Observer ante stock crítico."""

    @abstractmethod
    def notificar_stock_bajo(self, stock: "Stock") -> None:
        """Invocado cuando la cantidad disponible perfora o iguala el nivel mínimo."""
        pass


class Reposicion_Logistica_Service(Protocol):
    """Protocolo desacoplado para el servicio de reposición del módulo Logística."""

    def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> int | None:
        ...


class Alerta_Stock_Observer(Stock_Observer):
    """Observador que genera y persiste una alerta ante stock crítico."""

    def __init__(self, stock_repository: Any = None) -> None:
        self._stock_repository = stock_repository

    def notificar_stock_bajo(self, stock: "Stock") -> None:
        alerta = Alerta_Stock(
            stock_id=stock.id if stock.id is not None else 1,
            producto_id=stock.producto_id,
            ubicacion_id=stock.ubicacion_id,
            cantidad_disponible=stock.cantidad_disponible,
            nivel_minimo=stock.nivel_minimo_existencia,
            fecha_emision=datetime.now().isoformat(),
            leida=False,
        )
        if self._stock_repository is not None:
            self._stock_repository.registrar_alerta(alerta)


class Reposicion_Local_Observer(Stock_Observer):
    """Observador que solicita reposición al CD si la ubicación es un Local."""

    def __init__(
        self,
        reposicion_service: Reposicion_Logistica_Service,
        ubicacion_repository: Any = None,
    ) -> None:
        self._reposicion_service = reposicion_service
        self._ubicacion_repository = ubicacion_repository

    def notificar_stock_bajo(self, stock: "Stock") -> None:
        es_cd = False
        if getattr(stock, "ubicacion", None) is not None:
            es_cd = stock.ubicacion.es_centro_distribucion()
        elif self._ubicacion_repository is not None:
            ubicacion = self._ubicacion_repository.buscar_por_id(stock.ubicacion_id)
            if ubicacion is not None:
                es_cd = ubicacion.es_centro_distribucion()

        if es_cd:
            return

        cantidad_sugerida = stock.calcular_reposicion_sugerida()
        if cantidad_sugerida > 0:
            # El contrato de Logística devuelve ``None`` cuando ya hay una necesidad pendiente.
            self._reposicion_service.registrar_necesidad(
                producto_id=stock.producto_id,
                local_id=stock.ubicacion_id,
                cantidad=cantidad_sugerida,
            )
