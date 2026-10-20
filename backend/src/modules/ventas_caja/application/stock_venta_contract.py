from abc import ABC, abstractmethod


class Stock_Venta_Contract(ABC):
    """Operaciones de stock que ventas_caja necesita del Stock_Service de Integrante 1.

    Las implementaciones lanzan las excepciones de ubicaciones_stock:
    Stock_Insuficiente_Exception y Entidad_No_Encontrada_Exception.
    """

    @abstractmethod
    def validar_local(self, local_id: int) -> None:
        """Verifica que la ubicación exista, esté activa y sea un local de venta (no un CD)."""
        raise NotImplementedError

    @abstractmethod
    def consultar_disponible(self, producto_id: int, local_id: int) -> int:
        """Devuelve la cantidad disponible y verificada del producto en el local.

        Si el producto nunca tuvo stock en el local devuelve 0: para vender, no tener
        registro equivale a no tener unidades (V3), no a un recurso inexistente.
        """
        raise NotImplementedError

    @abstractmethod
    def descontar_por_venta(self, producto_id: int, local_id: int, cantidad: int) -> None:
        """Descuenta stock disponible del local por una venta confirmada."""
        raise NotImplementedError

    @abstractmethod
    def reingresar_por_devolucion(self, producto_id: int, local_id: int, cantidad: int) -> None:
        """Devuelve al stock disponible del local las unidades de una devolución aceptada."""
        raise NotImplementedError
