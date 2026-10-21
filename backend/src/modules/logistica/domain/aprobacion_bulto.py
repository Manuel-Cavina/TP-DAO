from datetime import datetime


class Aprobacion_Bulto:
    """Evidencia inmutable de aprobación previa a la inclusión en un remito (US4 / T042).

    Nota de diseño: La aprobación es una evidencia de preparación y control de calidad,
    NO añade un estado nuevo al ciclo de vida del bulto (el bulto permanece en PRECINTADO).
    """

    def __init__(
        self,
        bulto_id: int,
        id: int | None = None,
        actor: str | None = None,
        fecha_hora: datetime | None = None,
        observacion: str = "",
    ) -> None:
        if not isinstance(bulto_id, int) or isinstance(bulto_id, bool) or bulto_id <= 0:
            raise ValueError("El identificador del bulto debe ser un entero positivo.")

        self._id: int | None = id
        self._bulto_id: int = bulto_id
        self._actor: str | None = actor
        self._fecha_hora: datetime = fecha_hora if fecha_hora is not None else datetime.now()
        self._observacion: str = observacion

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise ValueError("No se puede modificar el id de una aprobación ya asignada.")
        self._id = valor

    @property
    def bulto_id(self) -> int:
        return self._bulto_id

    @property
    def actor(self) -> str | None:
        return self._actor

    @property
    def fecha_hora(self) -> datetime:
        return self._fecha_hora

    @property
    def observacion(self) -> str:
        return self._observacion
