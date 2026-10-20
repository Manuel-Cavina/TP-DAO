from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from modules.logistica.domain.exceptions import (
    Bulto_Vacio_Exception,
    Precinto_Invalido_Exception,
    Transicion_Estado_Invalida_Exception,
)

if TYPE_CHECKING:
    from modules.logistica.domain.bulto import Bulto
    from modules.logistica.domain.precinto import Precinto


class Estado_Bulto(ABC):
    """Clase base abstracta para el patron State del ciclo de vida del bulto."""

    @property
    @abstractmethod
    def nombre(self) -> str:
        """Devuelve el nombre identificador del estado."""
        raise NotImplementedError

    def precintar(self, bulto: Bulto, precinto: Precinto) -> None:
        raise Transicion_Estado_Invalida_Exception(
            f"No se puede precintar un bulto en estado '{self.nombre}'."
        )

    def despachar(self, bulto: Bulto) -> None:
        raise Transicion_Estado_Invalida_Exception(
            f"No se puede despachar un bulto en estado '{self.nombre}'."
        )

    def recibir(self, bulto: Bulto) -> None:
        raise Transicion_Estado_Invalida_Exception(
            f"No se puede recibir un bulto en estado '{self.nombre}'."
        )

    def verificar(
        self, bulto: Bulto, codigo_precinto_recibido: str, esta_intacto: bool
    ) -> None:
        raise Transicion_Estado_Invalida_Exception(
            f"No se puede verificar un bulto en estado '{self.nombre}'."
        )


class Estado_Preparado(Estado_Bulto):
    """Bulto armado con su mercaderia inicial en el Centro de Distribucion."""

    @property
    def nombre(self) -> str:
        return "PREPARADO"

    def precintar(self, bulto: Bulto, precinto: Precinto) -> None:
        if not bulto.detalles:
            raise Bulto_Vacio_Exception("No se puede precintar un bulto sin contenido.")
        if not precinto or not precinto.codigo:
            raise Precinto_Invalido_Exception("Se requiere un precinto valido con codigo.")
        if not precinto.esta_intacto:
            raise Precinto_Invalido_Exception("No se puede utilizar un precinto daniado o roto.")

        bulto._precinto = precinto
        bulto._cambiar_estado(
            Estado_Precintado(), f"Bulto precintado con codigo {precinto.codigo}"
        )


class Estado_Precintado(Estado_Bulto):
    """Bulto cerrado con precinto de seguridad, listo para ingresar a un remito y ser despachado."""

    @property
    def nombre(self) -> str:
        return "PRECINTADO"

    def despachar(self, bulto: Bulto) -> None:
        bulto._cambiar_estado(
            Estado_En_Transito(), "Bulto despachado desde el Centro de Distribucion"
        )


class Estado_En_Transito(Estado_Bulto):
    """Bulto en viaje logistico hacia el local destino."""

    @property
    def nombre(self) -> str:
        return "EN_TRANSITO"

    def recibir(self, bulto: Bulto) -> None:
        bulto._cambiar_estado(
            Estado_Recibido(), "Bulto arribado y recibido en local destino"
        )


class Estado_Recibido(Estado_Bulto):
    """Bulto recibido en el local destino, pendiente de verificacion fisica de su precinto."""

    @property
    def nombre(self) -> str:
        return "RECIBIDO"

    def verificar(
        self, bulto: Bulto, codigo_precinto_recibido: str, esta_intacto: bool
    ) -> None:
        if not bulto.precinto:
            bulto._cambiar_estado(
                Estado_Rechazado(), "Rechazado: el bulto no cuenta con precinto registrado."
            )
            return

        codigo_esperado = bulto.precinto.codigo.strip()
        codigo_recibido = codigo_precinto_recibido.strip() if codigo_precinto_recibido else ""

        if codigo_esperado == codigo_recibido and esta_intacto:
            bulto._cambiar_estado(
                Estado_Verificado(), "Precinto verificado e intacto conforme a remito."
            )
            return

        motivo = (
            f"Codigo no coincide (esperado: {codigo_esperado}, recibido: {codigo_recibido})"
            if codigo_esperado != codigo_recibido
            else "Precinto roto o violado al arribo"
        )
        bulto._cambiar_estado(Estado_Rechazado(), f"Bulto rechazado: {motivo}")


class Estado_Verificado(Estado_Bulto):
    """Estado terminal exitoso: precinto conforme, habilita ingreso a stock vendible."""

    @property
    def nombre(self) -> str:
        return "VERIFICADO"


class Estado_Rechazado(Estado_Bulto):
    """Estado terminal con fallo: precinto violado o incorrecto, pasa a merma y NO habilita venta."""

    @property
    def nombre(self) -> str:
        return "RECHAZADO"


def crear_estado_bulto_desde_string(nombre: str) -> Estado_Bulto:
    """Fabrica el estado correspondiente a partir de su representacion textual."""
    estados: dict[str, type[Estado_Bulto]] = {
        "PREPARADO": Estado_Preparado,
        "PRECINTADO": Estado_Precintado,
        "EN_TRANSITO": Estado_En_Transito,
        "RECIBIDO": Estado_Recibido,
        "VERIFICADO": Estado_Verificado,
        "RECHAZADO": Estado_Rechazado,
    }
    nombre_normalizado = nombre.strip().upper() if nombre else ""
    clase_estado = estados.get(nombre_normalizado)
    if clase_estado is None:
        raise Transicion_Estado_Invalida_Exception(
            f"El estado '{nombre}' no es un estado valido para un bulto."
        )
    return clase_estado()
