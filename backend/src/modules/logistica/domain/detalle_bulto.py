from errors.business_error import BusinessError


class Detalle_Bulto:
    """Representa un item de mercaderia contenido dentro de un bulto."""

    def __init__(self, producto_id: str, cantidad: int) -> None:
        if not producto_id or not producto_id.strip():
            raise BusinessError("El identificador del producto no puede estar vacio.")
        if cantidad <= 0:
            raise BusinessError("La cantidad en el bulto debe ser mayor a cero.")

        self._producto_id: str = producto_id.strip()
        self._cantidad: int = cantidad

    @property
    def producto_id(self) -> str:
        return self._producto_id

    @property
    def cantidad(self) -> int:
        return self._cantidad
