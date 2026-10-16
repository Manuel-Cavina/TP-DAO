from datetime import datetime

from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.estado_bulto import Estado_Bulto, Estado_Preparado
from modules.logistica.domain.exceptions import Transicion_Estado_Invalida_Exception
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.domain.precinto import Precinto


class Bulto:
    """Entidad central del modulo logistico cuyo ciclo de vida esta gestionado por el patron State."""

    def __init__(
        self,
        orden_id: int | str,
        id: int | str | None = None,
        estado: Estado_Bulto | None = None,
        precinto: Precinto | None = None,
        detalles: list[Detalle_Bulto] | None = None,
        historial: list[Historial_Bulto] | None = None,
    ) -> None:
        self._id: int | str | None = id
        self._orden_id: int | str = orden_id
        self._estado: Estado_Bulto = estado if estado is not None else Estado_Preparado()
        self._precinto: Precinto | None = precinto
        self._detalles: list[Detalle_Bulto] = list(detalles) if detalles else []
        self._historial: list[Historial_Bulto] = list(historial) if historial else []

        if not self._historial:
            self._historial.append(
                Historial_Bulto(
                    bulto_id=self._id or 0,
                    estado_anterior="INEXISTENTE",
                    estado_nuevo=self._estado.nombre,
                    fecha_hora=datetime.now(),
                    observacion="Creacion inicial del bulto",
                )
            )

    @property
    def id(self) -> int | str | None:
        return self._id

    @id.setter
    def id(self, valor: int | str) -> None:
        if self._id is not None:
            raise Transicion_Estado_Invalida_Exception("No se puede modificar el id de un bulto ya asignado.")
        self._id = valor

    @property
    def orden_id(self) -> int | str:
        return self._orden_id

    @property
    def estado(self) -> Estado_Bulto:
        return self._estado

    @property
    def precinto(self) -> Precinto | None:
        return self._precinto

    @property
    def detalles(self) -> list[Detalle_Bulto]:
        return list(self._detalles)

    @property
    def historial(self) -> list[Historial_Bulto]:
        return list(self._historial)

    def agregar_detalle(self, detalle: Detalle_Bulto) -> None:
        """Agrega mercaderia al bulto, solo permitido cuando esta en preparacion."""
        if self._estado.nombre != "PREPARADO":
            raise Transicion_Estado_Invalida_Exception(
                "Solo se puede agregar contenido a un bulto en preparacion."
            )
        self._detalles.append(detalle)

    def precintar(self, precinto: Precinto) -> None:
        """Delega la accion de precintado en su estado actual."""
        self._estado.precintar(self, precinto)

    def despachar(self) -> None:
        """Delega la accion de despacho en su estado actual."""
        self._estado.despachar(self)

    def recibir(self) -> None:
        """Delega la accion de recepcion en su estado actual."""
        self._estado.recibir(self)

    def verificar(self, codigo_precinto_recibido: str, esta_intacto: bool) -> None:
        """Delega la verificacion fisica de precinto en su estado actual."""
        self._estado.verificar(self, codigo_precinto_recibido, esta_intacto)

    def _cambiar_estado(self, nuevo_estado: Estado_Bulto, observacion: str = "") -> None:
        """Realiza la transicion de estado y asienta la trazabilidad inmutable."""
        estado_anterior = self._estado.nombre
        self._estado = nuevo_estado
        registro = Historial_Bulto(
            bulto_id=self._id or 0,
            estado_anterior=estado_anterior,
            estado_nuevo=nuevo_estado.nombre,
            fecha_hora=datetime.now(),
            observacion=observacion,
        )
        self._historial.append(registro)
