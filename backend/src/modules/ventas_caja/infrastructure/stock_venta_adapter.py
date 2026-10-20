"""Adaptador de Stock_Venta_Contract sobre el Stock_Service de ubicaciones_stock (Integrante 1).

Ventas no toca la tabla stocks: delega en la API pública (application) del dueño del stock,
que además dispara el Observer de stock bajo en cada venta.
"""

from modules.ubicaciones_stock.application import Stock_Service, Ubicacion_Service
from modules.ventas_caja.application.stock_venta_contract import Stock_Venta_Contract


class Stock_Venta_Adapter(Stock_Venta_Contract):
    """Traduce el puerto de ventas a los servicios de ubicaciones y stock."""

    def __init__(
        self,
        stock_service: Stock_Service | None = None,
        ubicacion_service: Ubicacion_Service | None = None,
    ) -> None:
        self._stock = stock_service if stock_service is not None else Stock_Service()
        self._ubicaciones = ubicacion_service if ubicacion_service is not None else Ubicacion_Service()

    def validar_local(self, local_id: int) -> None:
        self._ubicaciones.validar_local(local_id)

    def consultar_disponible(self, producto_id: int, local_id: int) -> int:
        return self._stock.consultar_disponible(producto_id, local_id)

    def descontar_por_venta(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._stock.descontar_por_venta(producto_id, local_id, cantidad)

    def reingresar_por_devolucion(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._stock.reingresar_por_devolucion(producto_id, local_id, cantidad)
