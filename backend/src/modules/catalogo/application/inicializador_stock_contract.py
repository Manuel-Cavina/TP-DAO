from abc import ABC, abstractmethod


class Inicializador_Stock_Contract(ABC):
    """Puerto hacia ubicaciones_stock: crear el Stock del producto nuevo en cada ubicación.

    Lo implementa Stock_Service; así catálogo no depende de ubicaciones_stock.
    """

    @abstractmethod
    def inicializar_stock_para_producto(self, producto_id: int, nivel_minimo_existencia: int) -> None:
        """Crea el stock en cero del producto en todas las ubicaciones activas."""
        raise NotImplementedError
