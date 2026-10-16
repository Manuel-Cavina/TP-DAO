from abc import ABC, abstractmethod
import sqlite3


class Stock_Service_Contract(ABC):
    """Contrato que debe cumplir el servicio de stock de Integrante 1 para interactuar con logistica."""

    @abstractmethod
    def reservar_para_despacho(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        cd_id: str,
        cantidad: int,
    ) -> None:
        """Descuenta stock disponible del Centro de Distribucion al preparar un bulto."""
        raise NotImplementedError

    @abstractmethod
    def registrar_en_transito(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> None:
        """Suma mercaderia a cantidad_en_transito del local destino al despachar el remito."""
        raise NotImplementedError

    @abstractmethod
    def acreditar_verificado(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> None:
        """Pasa mercaderia de cantidad_en_transito a cantidad_disponible tras verificar el precinto."""
        raise NotImplementedError

    @abstractmethod
    def registrar_merma(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> None:
        """Descuenta mercaderia de cantidad_en_transito como merma por rechazo logistico (no habilita venta)."""
        raise NotImplementedError


class Mock_Stock_Service(Stock_Service_Contract):
    """Implementacion simulada de Stock_Service para pruebas y ejecucion desacoplada."""

    def __init__(self) -> None:
        self.operaciones: list[tuple[str, str, str, int]] = []

    def reservar_para_despacho(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        cd_id: str,
        cantidad: int,
    ) -> None:
        self.operaciones.append(("RESERVAR", producto_id, cd_id, cantidad))

    def registrar_en_transito(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> None:
        self.operaciones.append(("EN_TRANSITO", producto_id, local_id, cantidad))

    def acreditar_verificado(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> None:
        self.operaciones.append(("ACREDITAR", producto_id, local_id, cantidad))

    def registrar_merma(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> None:
        self.operaciones.append(("MERMA", producto_id, local_id, cantidad))
