from datetime import datetime

from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.exceptions import Orden_Invalida_Exception


class Orden_Reposicion:
    """Orden de reposicion solicitada por un local o generada por el Centro de Distribucion."""

    ESTADOS_VALIDOS: tuple[str, ...] = ("PENDIENTE", "EN_PREPARACION", "DESPACHADA", "CERRADA")

    def __init__(
        self,
        origen_id: int,
        destino_id: int,
        id: int | None = None,
        fecha: datetime | None = None,
        estado: str = "PENDIENTE",
        detalles: list[Detalle_Orden_Reposicion] | None = None,
    ) -> None:
        if not _es_id_valido(origen_id):
            raise Orden_Invalida_Exception("El origen de la orden debe ser un identificador entero positivo.")
        if not _es_id_valido(destino_id):
            raise Orden_Invalida_Exception("El destino de la orden debe ser un identificador entero positivo.")
        if origen_id == destino_id:
            raise Orden_Invalida_Exception("El origen y destino de la orden no pueden ser iguales.")

        estado_normalizado = estado.strip().upper()
        if estado_normalizado not in self.ESTADOS_VALIDOS:
            raise Orden_Invalida_Exception(f"Estado de orden invalido: {estado}.")

        self._id: int | None = id
        self._origen_id: int = origen_id
        self._destino_id: int = destino_id
        self._fecha: datetime = fecha if fecha is not None else datetime.now()
        self._estado: str = estado_normalizado
        self._detalles: list[Detalle_Orden_Reposicion] = []
        for detalle in detalles or []:
            self._agregar_sin_duplicar(detalle)

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Orden_Invalida_Exception("No se puede reasignar el identificador de la orden.")
        self._id = valor

    @property
    def origen_id(self) -> int:
        return self._origen_id

    @property
    def destino_id(self) -> int:
        return self._destino_id

    @property
    def fecha(self) -> datetime:
        return self._fecha

    @property
    def estado(self) -> str:
        return self._estado

    @property
    def detalles(self) -> list[Detalle_Orden_Reposicion]:
        return list(self._detalles)

    def agregar_detalle(self, detalle: Detalle_Orden_Reposicion) -> None:
        """Agrega o incrementa un item en la orden si aun esta pendiente."""
        if self._estado != "PENDIENTE":
            raise Orden_Invalida_Exception(
                "Solo se pueden modificar items en una orden en estado PENDIENTE."
            )
        self._agregar_sin_duplicar(detalle)

    @property
    def esta_completamente_enviada(self) -> bool:
        """Todas las cantidades solicitadas ya fueron empaquetadas en bultos."""
        return bool(self._detalles) and all(d.esta_completo for d in self._detalles)

    def buscar_detalle(self, producto_id: int) -> Detalle_Orden_Reposicion | None:
        return next((d for d in self._detalles if d.producto_id == producto_id), None)

    def iniciar_preparacion(self) -> None:
        """Pasa la orden a preparacion al comenzar a armar bultos."""
        if self._estado != "PENDIENTE":
            raise Orden_Invalida_Exception(
                f"No se puede iniciar preparacion desde el estado '{self._estado}'."
            )
        if not self._detalles:
            raise Orden_Invalida_Exception("La orden debe tener al menos un detalle para prepararse.")
        self._estado = "EN_PREPARACION"

    def despachar(self) -> None:
        """Marca la orden como despachada cuando ya no queda mercaderia por enviar."""
        if self._estado != "EN_PREPARACION":
            raise Orden_Invalida_Exception(
                f"No se puede despachar una orden en estado '{self._estado}'."
            )
        self._estado = "DESPACHADA"

    def cerrar(self) -> None:
        """Cierra la orden una vez completada la recepcion en el local."""
        if self._estado != "DESPACHADA":
            raise Orden_Invalida_Exception(
                f"No se puede cerrar una orden en estado '{self._estado}'."
            )
        self._estado = "CERRADA"

    def _agregar_sin_duplicar(self, detalle: Detalle_Orden_Reposicion) -> None:
        if self.buscar_detalle(detalle.producto_id) is not None:
            raise Orden_Invalida_Exception(
                f"El producto '{detalle.producto_id}' ya se encuentra en la orden."
            )
        self._detalles.append(detalle)


def _es_id_valido(valor: int) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool) and valor > 0
