"""Adaptador de Stock_Service_Contract sobre los servicios de Integrante 1.

Logística no toca las tablas de stock ni de catálogo: delega en la API pública
(application) de ubicaciones_stock y catalogo.
"""

from modules.catalogo.application import Catalogo_Consulta_Service
from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.ubicaciones_stock.application import Stock_Service, Ubicacion_Service


class Stock_Logistica_Adapter(Stock_Service_Contract):
    """Movimientos de stock del circuito CD -> local: reserva, tránsito, acreditación y merma."""

    def __init__(
        self,
        stock_service: Stock_Service | None = None,
        ubicacion_service: Ubicacion_Service | None = None,
        catalogo: Catalogo_Consulta_Service | None = None,
    ) -> None:
        self._stock = stock_service if stock_service is not None else Stock_Service()
        self._ubicaciones = ubicacion_service if ubicacion_service is not None else Ubicacion_Service()
        self._catalogo = catalogo if catalogo is not None else Catalogo_Consulta_Service()

    def validar_centro_distribucion(self, ubicacion_id: int) -> None:
        self._ubicaciones.validar_centro_distribucion(ubicacion_id)

    def validar_local(self, ubicacion_id: int) -> None:
        self._ubicaciones.validar_local(ubicacion_id)

    def validar_producto(self, producto_id: int) -> None:
        self._catalogo.obtener_producto_activo(producto_id)

    def reservar_para_despacho(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        self._stock.reservar_para_despacho(producto_id, cd_id, cantidad)

    def registrar_en_transito(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._stock.registrar_en_transito(producto_id, local_id, cantidad)

    def acreditar_verificado(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._stock.acreditar_verificado(producto_id, local_id, cantidad)

    def registrar_merma(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._stock.registrar_merma(producto_id, local_id, cantidad)
