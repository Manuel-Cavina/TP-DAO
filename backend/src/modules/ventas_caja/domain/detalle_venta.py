from decimal import Decimal

from modules.ventas_caja.domain.exceptions import Venta_Invalida_Exception


class Detalle_Venta:
    """Línea de una venta: producto, cantidad y precio unitario al momento de vender."""

    def __init__(self, producto_id: int, cantidad: int, precio_unitario: Decimal) -> None:
        if not _es_entero_positivo(producto_id):
            raise Venta_Invalida_Exception("El identificador del producto debe ser un entero positivo.")
        if not _es_entero_positivo(cantidad):
            raise Venta_Invalida_Exception("La cantidad vendida debe ser un entero mayor a cero.")
        if not isinstance(precio_unitario, Decimal):
            raise Venta_Invalida_Exception("El precio unitario debe ser Decimal.")
        if precio_unitario <= 0:
            raise Venta_Invalida_Exception("El precio unitario debe ser mayor a cero.")

        self._producto_id = producto_id
        self._cantidad = cantidad
        self._precio_unitario = precio_unitario

    @property
    def producto_id(self) -> int:
        return self._producto_id

    @property
    def cantidad(self) -> int:
        return self._cantidad

    @property
    def precio_unitario(self) -> Decimal:
        return self._precio_unitario

    @property
    def subtotal(self) -> Decimal:
        return self._precio_unitario * self._cantidad


def _es_entero_positivo(valor: int) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool) and valor > 0
