from domain.model.catalogo.producto import Producto


class DetalleVenta:
    def __init__(self, producto: Producto, cantidad: int, precio_unitario: float):
        self._producto = producto
        self._cantidad = cantidad
        self._precio_unitario = precio_unitario

    @property
    def producto(self) -> Producto:
        return self._producto

    @producto.setter
    def producto(self, value: Producto) -> None:
        self._producto = value

    @property
    def cantidad(self) -> int:
        return self._cantidad

    @cantidad.setter
    def cantidad(self, value: int) -> None:
        self._cantidad = value

    @property
    def precio_unitario(self) -> float:
        return self._precio_unitario

    @precio_unitario.setter
    def precio_unitario(self, value: float) -> None:
        self._precio_unitario = value

    def calcular_subtotal(self) -> float:
        raise NotImplementedError
