from abc import ABC, abstractmethod


class Stock_Service_Contract(ABC):
    """Operaciones de catalogo y stock de Integrante 1 que logistica necesita.

    Las implementaciones lanzan las excepciones de ubicaciones_stock
    (Stock_Insuficiente_Exception, Entidad_No_Encontrada_Exception) y de catalogo
    (Entidad_No_Encontrada_Exception) cuando corresponde.
    """

    @abstractmethod
    def validar_centro_distribucion(self, ubicacion_id: int) -> None:
        """Verifica que la ubicacion exista, este activa y sea un Centro de Distribucion."""
        raise NotImplementedError

    @abstractmethod
    def validar_local(self, ubicacion_id: int) -> None:
        """Verifica que la ubicacion exista, este activa y sea un local de venta."""
        raise NotImplementedError

    @abstractmethod
    def validar_producto(self, producto_id: int) -> None:
        """Verifica que el producto exista y este activo."""
        raise NotImplementedError

    @abstractmethod
    def reservar_para_despacho(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        """Descuenta stock disponible del Centro de Distribucion al preparar un bulto."""
        raise NotImplementedError

    @abstractmethod
    def registrar_en_transito(self, producto_id: int, local_id: int, cantidad: int) -> None:
        """Suma mercaderia a cantidad_en_transito del local destino al despachar el remito."""
        raise NotImplementedError

    @abstractmethod
    def acreditar_verificado(self, producto_id: int, local_id: int, cantidad: int) -> None:
        """Pasa mercaderia de cantidad_en_transito a cantidad_disponible tras verificar el precinto."""
        raise NotImplementedError

    @abstractmethod
    def registrar_merma(self, producto_id: int, local_id: int, cantidad: int) -> None:
        """Descuenta mercaderia de cantidad_en_transito como merma por rechazo logistico (no habilita venta)."""
        raise NotImplementedError
