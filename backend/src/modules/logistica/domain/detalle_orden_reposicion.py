from modules.logistica.domain.exceptions import Orden_Invalida_Exception


class Detalle_Orden_Reposicion:
    """Detalle de un producto solicitado dentro de una orden de reposicion."""

    def __init__(
        self,
        producto_id: str,
        cantidad_solicitada: int,
        cantidad_enviada: int = 0,
    ) -> None:
        if not producto_id or not producto_id.strip():
            raise Orden_Invalida_Exception("El producto no puede estar vacio.")
        if cantidad_solicitada <= 0:
            raise Orden_Invalida_Exception("La cantidad solicitada debe ser mayor a cero.")
        if cantidad_enviada < 0:
            raise Orden_Invalida_Exception("La cantidad enviada no puede ser negativa.")
        if cantidad_enviada > cantidad_solicitada:
            raise Orden_Invalida_Exception("La cantidad enviada no puede superar la solicitada.")

        self._producto_id: str = producto_id.strip()
        self._cantidad_solicitada: int = cantidad_solicitada
        self._cantidad_enviada: int = cantidad_enviada

    @property
    def producto_id(self) -> str:
        return self._producto_id

    @property
    def cantidad_solicitada(self) -> int:
        return self._cantidad_solicitada

    @property
    def cantidad_enviada(self) -> int:
        return self._cantidad_enviada

    def registrar_envio(self, cantidad: int) -> None:
        """Incrementa la cantidad enviada garantizando no exceder lo solicitado."""
        if cantidad <= 0:
            raise Orden_Invalida_Exception("La cantidad a enviar debe ser mayor a cero.")
        if self._cantidad_enviada + cantidad > self._cantidad_solicitada:
            raise Orden_Invalida_Exception(
                f"Lo enviado en una orden ({self._cantidad_enviada + cantidad}) no puede superar lo solicitado ({self._cantidad_solicitada})."
            )
        self._cantidad_enviada += cantidad
