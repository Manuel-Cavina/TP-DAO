from datetime import datetime

from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.exceptions import Orden_Invalida_Exception


class Orden_Reposicion:
    """Orden de reposicion solicitada por un local o generada por el Centro de Distribucion."""

    ESTADOS_VALIDOS: tuple[str, ...] = ("PENDIENTE", "EN_PREPARACION", "DESPACHADA", "CERRADA")

    def __init__(
        self,
        origen_id: str,
        destino_id: str,
        id: int | str | None = None,
        fecha: datetime | None = None,
        estado: str = "PENDIENTE",
        detalles: list[Detalle_Orden_Reposicion] | None = None,
    ) -> None:
        if not origen_id or not origen_id.strip():
            raise Orden_Invalida_Exception("El origen de la orden es obligatorio.")
        if not destino_id or not destino_id.strip():
            raise Orden_Invalida_Exception("El destino de la orden es obligatorio.")
        if origen_id.strip() == destino_id.strip():
            raise Orden_Invalida_Exception("El origen y destino de la orden no pueden ser iguales.")

        estado_normalizado = estado.strip().upper()
        if estado_normalizado not in self.ESTADOS_VALIDOS:
            raise Orden_Invalida_Exception(f"Estado de orden invalido: {estado}.")

        self._id: int | str | None = id
        self._origen_id: str = origen_id.strip()
        self._destino_id: str = destino_id.strip()
        self._fecha: datetime = fecha if fecha is not None else datetime.now()
        self._estado: str = estado_normalizado
        self._detalles: list[Detalle_Orden_Reposicion] = list(detalles) if detalles else []

    @property
    def id(self) -> int | str | None:
        return self._id

    @id.setter
    def id(self, valor: int | str) -> None:
        if self._id is not None:
            raise Orden_Invalida_Exception("No se puede reasignar el identificador de la orden.")
        self._id = valor

    @property
    def origen_id(self) -> str:
        return self._origen_id

    @property
    def destino_id(self) -> str:
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
        for d in self._detalles:
            if d.producto_id == detalle.producto_id:
                raise Orden_Invalida_Exception(
                    f"El producto '{detalle.producto_id}' ya se encuentra en la orden."
                )
        self._detalles.append(detalle)

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
        """Marca la orden como despachada al emitir y despachar sus remitos."""
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
