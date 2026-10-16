"""Middleware que delimita una transacción ORM por petición HTTP."""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from config.database.session_factory import Session_Factory


class Database_Session_Middleware(BaseHTTPMiddleware):
    """Confirma sólo respuestas exitosas y siempre libera la sesión."""

    def __init__(self, app: Callable[..., Awaitable[None]], session_factory: Session_Factory | None = None) -> None:
        super().__init__(app)
        self._session_factory = session_factory or Database_Engine_Singleton.obtener_session_factory()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        sesion = self._session_factory.crear_sesion()
        token = Request_Session_Context.establecer_sesion(sesion)
        try:
            response = await call_next(request)
            if response.status_code < 400:
                sesion.commit()
            else:
                sesion.rollback()
            return response
        except BaseException:
            sesion.rollback()
            raise
        finally:
            Request_Session_Context.restablecer(token)
            sesion.close()
