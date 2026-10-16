from abc import ABC, abstractmethod


class Stock_Service_Contract(ABC):
    """Contrato que debe cumplir el servicio de stock de Integrante 1 para interactuar con logistica."""

    @abstractmethod
    def reservar_para_despacho(
        self,
        producto_id: int,
        cd_id: int,
        cantidad: int,
    ) -> None:
        """Descuenta stock disponible del Centro de Distribucion al preparar un bulto."""
        raise NotImplementedError

    @abstractmethod
    def registrar_en_transito(
        self,
        producto_id: int,
        local_id: int,
        cantidad: int,
    ) -> None:
        """Suma mercaderia a cantidad_en_transito del local destino al despachar el remito."""
        raise NotImplementedError

    @abstractmethod
    def acreditar_verificado(
        self,
        producto_id: int,
        local_id: int,
        cantidad: int,
    ) -> None:
        """Pasa mercaderia de cantidad_en_transito a cantidad_disponible tras verificar el precinto."""
        raise NotImplementedError

    @abstractmethod
    def registrar_merma(
        self,
        producto_id: int,
        local_id: int,
        cantidad: int,
    ) -> None:
        """Descuenta mercaderia de cantidad_en_transito como merma por rechazo logistico (no habilita venta)."""
        raise NotImplementedError
