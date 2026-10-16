from errors.business_error import BusinessError


class Detalle_Bulto:
    """Representa un item de mercaderia contenido dentro de un bulto."""

    def __init__(self, producto_id: int, cantidad: int) -> None:
        if producto_id <= 0:
            raise BusinessError("El identificador del producto debe ser positivo.")
        if cantidad <= 0:
            raise BusinessError("La cantidad en el bulto debe ser mayor a cero.")

        self._producto_id: int = producto_id
        self._cantidad: int = cantidad

    @property
    def producto_id(self) -> int:
        return self._producto_id

    @property
    def cantidad(self) -> int:
        return self._cantidad
