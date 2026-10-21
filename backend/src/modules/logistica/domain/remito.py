from datetime import datetime

from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.exceptions import Remito_Incompleto_Exception


class Remito:
    """Documento de remito que agrupa los bultos de un despacho entre el CD y un local."""

    ESTADOS_VALIDOS: tuple[str, ...] = ("EMITIDO", "DESPACHADO", "CERRADO")

    def __init__(
        self,
        numero: str,
        origen_id: int,
        destino_id: int,
        bultos: list[Bulto] | None = None,
        fecha_emision: datetime | None = None,
        estado: str = "EMITIDO",
    ) -> None:
        if not numero or not numero.strip():
            raise Remito_Incompleto_Exception("El numero de remito no puede estar vacio.")
        if not isinstance(origen_id, int) or origen_id <= 0:
            raise Remito_Incompleto_Exception("El origen del remito es obligatorio.")
        if not isinstance(destino_id, int) or destino_id <= 0:
            raise Remito_Incompleto_Exception("El destino del remito es obligatorio.")

        estado_normalizado = estado.strip().upper()
        if estado_normalizado not in self.ESTADOS_VALIDOS:
            raise Remito_Incompleto_Exception(f"Estado de remito invalido: {estado}.")

        self._numero: str = numero.strip()
        self._origen_id: int = origen_id
        self._destino_id: int = destino_id
        self._fecha_emision: datetime = fecha_emision if fecha_emision is not None else datetime.now()
        self._estado: str = estado_normalizado
        self._bultos: list[Bulto] = list(bultos) if bultos else []

    @property
    def numero(self) -> str:
        return self._numero

    @property
    def origen_id(self) -> int:
        return self._origen_id

    @property
    def destino_id(self) -> int:
        return self._destino_id

    @property
    def fecha_emision(self) -> datetime:
        return self._fecha_emision

    @property
    def estado(self) -> str:
        return self._estado

    @property
    def bultos(self) -> list[Bulto]:
        return list(self._bultos)

    def agregar_bulto(self, bulto: Bulto) -> None:
        """Agrega un bulto al remito si el remito esta en emision y el bulto esta precintado."""
        if self._estado != "EMITIDO":
            raise Remito_Incompleto_Exception(
                "Solo se pueden agregar bultos a un remito en estado EMITIDO."
            )
        if bulto.estado.nombre != "PRECINTADO":
            raise Remito_Incompleto_Exception(
                f"No se puede agregar al remito el bulto '{bulto.id}': debe estar PRECINTADO (estado actual: {bulto.estado.nombre})."
            )
        self._bultos.append(bulto)

    def despachar(self) -> None:
        """Despacha el remito completo validando que todos sus bultos esten precintados."""
        if self._estado != "EMITIDO":
            raise Remito_Incompleto_Exception(
                f"No se puede despachar un remito en estado '{self._estado}'."
            )
        if not self._bultos:
            raise Remito_Incompleto_Exception("No se puede despachar un remito sin bultos.")

        for b in self._bultos:
            if b.estado.nombre != "PRECINTADO":
                raise Remito_Incompleto_Exception(
                    f"El bulto '{b.id}' no esta PRECINTADO. No se puede despachar el remito."
                )

        for b in self._bultos:
            b.despachar()

        self._estado = "DESPACHADO"

    def recibir(self) -> None:
        """Registra la llegada de los bultos del remito en la sucursal destino."""
        if self._estado != "DESPACHADO":
            raise Remito_Incompleto_Exception(
                f"No se puede recibir un remito en estado '{self._estado}'."
            )
        for b in self._bultos:
            b.recibir()

    def cerrar(self) -> None:
        """Cierra el remito unicamente cuando todos sus bultos fueron verificados o rechazados."""
        if self._estado != "DESPACHADO":
            raise Remito_Incompleto_Exception(
                f"No se puede cerrar un remito en estado '{self._estado}'."
            )
        if not self._bultos:
            raise Remito_Incompleto_Exception("El remito no tiene bultos para cerrar.")

        for b in self._bultos:
            if b.estado.nombre not in ("VERIFICADO", "RECHAZADO"):
                raise Remito_Incompleto_Exception(
                    f"El bulto '{b.id}' todavia se encuentra en estado '{b.estado.nombre}'. Debe ser verificado o rechazado antes del cierre."
                )

        self._estado = "CERRADO"
