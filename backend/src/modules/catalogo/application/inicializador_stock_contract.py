from abc import ABC, abstractmethod


class Inicializador_Stock_Contract(ABC):
    """Puerto hacia ubicaciones_stock: crear o actualizar el Stock del producto en cada ubicación.

    Lo implementa Stock_Service; así catálogo no depende de ubicaciones_stock.
    """

    @abstractmethod
    def inicializar_stock_para_producto(self, producto_id: int, nivel_minimo_existencia: int) -> None:
        """Crea el stock en cero del producto en todas las ubicaciones activas."""
        raise NotImplementedError

    @abstractmethod
    def actualizar_nivel_minimo_para_producto(self, producto_id: int, nivel_minimo_existencia: int) -> None:
        """Actualiza el nivel mínimo de existencia del producto en todas sus ubicaciones."""
        raise NotImplementedError
