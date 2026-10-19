"""Implementaciones en memoria de los contratos de ventas_caja para usar en tests."""

from decimal import Decimal

from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Stock_No_Encontrado_Exception,
    Stock_Insuficiente_Exception,
)
from modules.ventas_caja.application.catalogo_venta_contract import Catalogo_Venta_Contract
from modules.ventas_caja.application.stock_venta_contract import Stock_Venta_Contract


class Fake_Stock_Venta(Stock_Venta_Contract):
    """Stock por (producto_id, local_id) que registra cada operación recibida."""

    def __init__(self, stock_inicial: dict[tuple[int, int], int] | None = None) -> None:
        self._stock = dict(stock_inicial or {})
        self.operaciones: list[tuple[str, int, int, int]] = []

    def consultar_disponible(self, producto_id: int, local_id: int) -> int:
        return self._buscar(producto_id, local_id)

    def descontar_por_venta(self, producto_id: int, local_id: int, cantidad: int) -> None:
        disponible = self._buscar(producto_id, local_id)
        if cantidad > disponible:
            raise Stock_Insuficiente_Exception(
                f"Stock insuficiente del producto {producto_id} en el local {local_id}."
            )
        self._stock[(producto_id, local_id)] = disponible - cantidad
        self.operaciones.append(("DESCONTAR", producto_id, local_id, cantidad))

    def reingresar_por_devolucion(self, producto_id: int, local_id: int, cantidad: int) -> None:
        disponible = self._buscar(producto_id, local_id)
        self._stock[(producto_id, local_id)] = disponible + cantidad
        self.operaciones.append(("REINGRESAR", producto_id, local_id, cantidad))

    def _buscar(self, producto_id: int, local_id: int) -> int:
        if (producto_id, local_id) not in self._stock:
            raise Stock_No_Encontrado_Exception(
                f"No existe stock del producto {producto_id} en el local {local_id}."
            )
        return self._stock[(producto_id, local_id)]


class Fake_Catalogo_Venta(Catalogo_Venta_Contract):
    """Catálogo en memoria con los precios de venta vigentes."""

    def __init__(self, precios: dict[int, Decimal] | None = None) -> None:
        self._precios = dict(precios or {})

    def obtener_precio_venta(self, producto_id: int) -> Decimal:
        if producto_id not in self._precios:
            raise Producto_No_Encontrado_Exception(f"No existe el producto {producto_id}.")
        return self._precios[producto_id]
