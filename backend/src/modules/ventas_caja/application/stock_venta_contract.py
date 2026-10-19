from abc import ABC, abstractmethod


class Stock_Venta_Contract(ABC):
    """Operaciones de stock que ventas_caja necesita del Stock_Service de Integrante 1.

    Las implementaciones lanzan las excepciones de ubicaciones_stock:
    Stock_Insuficiente_Exception y Entidad_No_Encontrada_Exception.
    """

    @abstractmethod
    def consultar_disponible(self, producto_id: int, local_id: int) -> int:
        """Devuelve la cantidad disponible y verificada del producto en el local."""
        raise NotImplementedError

    @abstractmethod
    def descontar_por_venta(self, producto_id: int, local_id: int, cantidad: int) -> None:
        """Descuenta stock disponible del local por una venta confirmada."""
        raise NotImplementedError

    @abstractmethod
    def reingresar_por_devolucion(self, producto_id: int, local_id: int, cantidad: int) -> None:
        """Devuelve al stock disponible del local las unidades de una devolución aceptada."""
        raise NotImplementedError
