from decimal import Decimal

from modules.ventas_caja.domain.exceptions import Devolucion_Invalida_Exception


class Detalle_Devolucion:
    """Línea devuelta: apunta al producto de la línea original y reintegra su precio histórico."""

    def __init__(self, producto_id: int, cantidad: int, precio_unitario: Decimal) -> None:
        if not isinstance(cantidad, int) or isinstance(cantidad, bool) or cantidad <= 0:
            raise Devolucion_Invalida_Exception("La cantidad devuelta debe ser un entero mayor a cero.")

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
    def monto(self) -> Decimal:
        return self._precio_unitario * self._cantidad
