from modules.logistica.domain.exceptions import Bulto_Invalido_Exception


class Detalle_Bulto:
    """Representa un item de mercaderia contenido dentro de un bulto."""

    def __init__(self, producto_id: int, cantidad: int) -> None:
        if not _es_entero_positivo(producto_id):
            raise Bulto_Invalido_Exception("El identificador del producto debe ser un entero positivo.")
        if not _es_entero_positivo(cantidad):
            raise Bulto_Invalido_Exception("La cantidad en el bulto debe ser un entero mayor a cero.")

        self._producto_id: int = producto_id
        self._cantidad: int = cantidad

    @property
    def producto_id(self) -> int:
        return self._producto_id

    @property
    def cantidad(self) -> int:
        return self._cantidad


def _es_entero_positivo(valor: int) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool) and valor > 0
