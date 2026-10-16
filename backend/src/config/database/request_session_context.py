"""Contexto aislado de la sesión ORM activa por petición."""

from contextvars import ContextVar, Token

from sqlalchemy.orm import Session


class Request_Session_Context:
    """Expone la sesión de request a repositories sin propagarla por firmas."""

    _sesion_actual: ContextVar[Session | None] = ContextVar("sesion_actual", default=None)

    @classmethod
    def establecer_sesion(cls, sesion: Session) -> Token[Session | None]:
        return cls._sesion_actual.set(sesion)

    @classmethod
    def obtener_sesion(cls) -> Session:
        sesion = cls._sesion_actual.get()
        if sesion is None:
            raise RuntimeError("No existe una sesión ORM activa para esta petición.")
        return sesion

    @classmethod
    def restablecer(cls, token: Token[Session | None]) -> None:
        cls._sesion_actual.reset(token)
