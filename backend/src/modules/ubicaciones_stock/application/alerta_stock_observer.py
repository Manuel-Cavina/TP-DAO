from datetime import datetime

from modules.ubicaciones_stock.domain import Alerta_Stock, Stock, Stock_Observer
from modules.ubicaciones_stock.infrastructure.alerta_stock_repository import Alerta_Stock_Repository


class Alerta_Stock_Observer(Stock_Observer):
    """Observer que deja una alerta visible para el frontend; no repite si hay una sin leer."""

    def __init__(self, alerta_repository: Alerta_Stock_Repository | None = None) -> None:
        self._repository = alerta_repository if alerta_repository is not None else Alerta_Stock_Repository()

    def notificar_stock_bajo(self, stock: Stock) -> None:
        if self._repository.existe_no_leida(stock.id):
            return
        self._repository.guardar(
            Alerta_Stock(
                stock_id=stock.id,
                producto_id=stock.producto_id,
                ubicacion_id=stock.ubicacion_id,
                cantidad_disponible=stock.cantidad_disponible,
                nivel_minimo=stock.nivel_minimo_existencia,
                fecha_emision=datetime.now(),
            )
        )
