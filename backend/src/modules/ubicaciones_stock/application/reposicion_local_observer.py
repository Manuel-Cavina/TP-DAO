from modules.ubicaciones_stock.application.registro_necesidad_contract import Registro_Necesidad_Contract
from modules.ubicaciones_stock.domain import Stock, Stock_Observer


class Reposicion_Local_Observer(Stock_Observer):
    """Observer que pide reposición al CD cuando un local queda en o bajo su mínimo.

    Cantidad sugerida: nivel_minimo * 2 - disponible. El CD no se repone por este camino.
    """

    def __init__(self, registro_necesidad: Registro_Necesidad_Contract) -> None:
        self._registro = registro_necesidad

    def notificar_stock_bajo(self, stock: Stock) -> None:
        if not stock.es_local or stock.reposicion_sugerida <= 0:
            return
        self._registro.registrar_necesidad(stock.producto_id, stock.ubicacion_id, stock.reposicion_sugerida)
