from datetime import datetime


class Evento_Trazabilidad:
    """Registro inmutable de trazabilidad y auditoría para entidades logísticas (V2/US3)."""

    def __init__(
        self,
        tipo_entidad: str,
        entidad_id: int,
        estado_nuevo: str,
        accion: str = "CREACION",
        estado_anterior: str | None = None,
        actor: str | None = None,
        origen_id: int | None = None,
        destino_id: int | None = None,
        registros_asociados: str | None = None,
        motivo_o_evidencia: str | None = None,
        fecha_hora: datetime | None = None,
        id: int | None = None,
    ) -> None:
        self._id: int | None = id
        self._tipo_entidad: str = tipo_entidad.strip().upper()
        self._entidad_id: int = entidad_id
        self._accion: str = accion.strip().upper()
        self._estado_anterior: str | None = estado_anterior
        self._estado_nuevo: str = estado_nuevo.strip().upper()
        self._actor: str | None = actor
        self._origen_id: int | None = origen_id
        self._destino_id: int | None = destino_id
        self._registros_asociados: str | None = registros_asociados
        self._motivo_o_evidencia: str | None = motivo_o_evidencia
        self._fecha_hora: datetime = fecha_hora if fecha_hora is not None else datetime.now()

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise ValueError("No se puede reasignar el identificador del evento de trazabilidad.")
        self._id = valor

    @property
    def tipo_entidad(self) -> str:
        return self._tipo_entidad

    @property
    def entidad_id(self) -> int:
        return self._entidad_id

    @property
    def accion(self) -> str:
        return self._accion

    @property
    def estado_anterior(self) -> str | None:
        return self._estado_anterior

    @property
    def estado_nuevo(self) -> str:
        return self._estado_nuevo

    @property
    def actor(self) -> str | None:
        return self._actor

    @property
    def origen_id(self) -> int | None:
        return self._origen_id

    @property
    def destino_id(self) -> int | None:
        return self._destino_id

    @property
    def registros_asociados(self) -> str | None:
        return self._registros_asociados

    @property
    def motivo_o_evidencia(self) -> str | None:
        return self._motivo_o_evidencia

    @property
    def fecha_hora(self) -> datetime:
        return self._fecha_hora
