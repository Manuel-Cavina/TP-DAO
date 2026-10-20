from abc import ABC, abstractmethod
from decimal import Decimal


class Catalogo_Venta_Contract(ABC):
    """Consultas al catálogo de Integrante 1 que ventas_caja necesita para vender.

    Las implementaciones lanzan Entidad_No_Encontrada_Exception de catalogo
    cuando el producto no existe o está inactivo.
    """

    @abstractmethod
    def obtener_precio_venta(self, producto_id: int) -> Decimal:
        """Devuelve el precio de venta vigente del producto."""
        raise NotImplementedError
