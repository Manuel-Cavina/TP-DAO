"""Adaptador de Catalogo_Venta_Contract sobre la API pública del catálogo (Integrante 1)."""

from decimal import Decimal

from modules.catalogo.application import Catalogo_Consulta_Service
from modules.ventas_caja.application.catalogo_venta_contract import Catalogo_Venta_Contract
from modules.ventas_caja.domain.estrategia_pago import redondear


class Catalogo_Venta_Adapter(Catalogo_Venta_Contract):
    """Precio de venta vigente de un producto activo."""

    def __init__(self, catalogo: Catalogo_Consulta_Service | None = None) -> None:
        self._catalogo = catalogo if catalogo is not None else Catalogo_Consulta_Service()

    def obtener_precio_venta(self, producto_id: int) -> Decimal:
        return redondear(self._catalogo.obtener_producto_activo(producto_id).precio_venta)
