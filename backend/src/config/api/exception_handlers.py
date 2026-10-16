"""Traducción central de errores a respuestas HTTP seguras."""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from errors.business_error import BusinessError
from errors.persistence_error import Persistencia_Exception

_logger = logging.getLogger(__name__)
_ESTADOS_NEGOCIO = {
    "Entidad_No_Encontrada_Exception": 404,
    "Entidad_Duplicada_Exception": 409,
}


def registrar_manejadores_excepciones(app: FastAPI) -> None:
    """Registra respuestas homogéneas sin filtrar detalles de infraestructura."""

    @app.exception_handler(BusinessError)
    async def manejar_error_negocio(_request: Request, error: BusinessError) -> JSONResponse:
        estado = _ESTADOS_NEGOCIO.get(type(error).__name__, 400)
        return JSONResponse(status_code=estado, content={"detail": str(error)})

    @app.exception_handler(Persistencia_Exception)
    async def manejar_error_persistencia(_request: Request, error: Persistencia_Exception) -> JSONResponse:
        _logger.exception("Fallo de persistencia", exc_info=error)
        return JSONResponse(status_code=500, content={"detail": "Error interno de persistencia."})

    @app.exception_handler(RequestValidationError)
    async def manejar_validacion(_request: Request, error: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": error.errors()})

    @app.exception_handler(HTTPException)
    async def manejar_error_http(_request: Request, error: HTTPException) -> JSONResponse:
        if error.status_code >= 500:
            return JSONResponse(status_code=500, content={"detail": "Error interno del servidor."})
        return JSONResponse(status_code=error.status_code, content={"detail": error.detail})

    @app.exception_handler(Exception)
    async def manejar_error_no_controlado(_request: Request, error: Exception) -> JSONResponse:
        _logger.exception("Error no controlado", exc_info=error)
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor."})
