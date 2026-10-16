from datetime import datetime


class Historial_Bulto:
    """Registro inmutable de trazabilidad que documenta los cambios de estado de un bulto."""

    def __init__(
        self,
        bulto_id: int | str,
        estado_anterior: str,
        estado_nuevo: str,
        fecha_hora: datetime | None = None,
        observacion: str = "",
    ) -> None:
        self._bulto_id: int | str = bulto_id
        self._estado_anterior: str = estado_anterior
        self._estado_nuevo: str = estado_nuevo
        self._fecha_hora: datetime = fecha_hora if fecha_hora is not None else datetime.now()
        self._observacion: str = observacion

    @property
    def bulto_id(self) -> int | str:
        return self._bulto_id

    @property
    def estado_anterior(self) -> str:
        return self._estado_anterior

    @property
    def estado_nuevo(self) -> str:
        return self._estado_nuevo

    @property
    def fecha_hora(self) -> datetime:
        return self._fecha_hora

    @property
    def observacion(self) -> str:
        return self._observacion
