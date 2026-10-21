"""Endpoints HTTP para autenticación, sesión y autorización."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response, status

from modules.seguridad.api.dependencies import (
    COOKIE_NAME,
    extraer_token_de_request,
    obtener_auth_service,
    obtener_seguridad_repository,
    obtener_sesion_actual,
    obtener_usuario_actual,
    requerir_rol,
    validar_csrf,
)
from modules.seguridad.application.auth_service import Auth_Service
from modules.seguridad.domain.usuario import ROL_ADMIN, ROL_OPERADOR, Sesion, Usuario
from modules.seguridad.dto.seguridad_dto import (
    Login_Request_DTO,
    Login_Response_DTO,
    Usuario_Response_DTO,
)
from modules.seguridad.infrastructure.seguridad_repository import Seguridad_Repository
from modules.seguridad.mappers.seguridad_mapper import Seguridad_Mapper

seguridad_router = APIRouter(prefix="/api/seguridad", tags=["Seguridad"])
auth_router = APIRouter(prefix="/api/auth", tags=["Seguridad"])


def _login_handler(
    body: Login_Request_DTO,
    response: Response,
    auth_service: Auth_Service,
) -> Login_Response_DTO:
    usuario, sesion, raw_token = auth_service.autenticar(body.login, body.password)
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return Seguridad_Mapper.login_a_response_dto(usuario, sesion)


def _me_handler(datos_sesion: tuple[Usuario, Sesion]) -> Login_Response_DTO:
    usuario, sesion = datos_sesion
    return Seguridad_Mapper.login_a_response_dto(usuario, sesion)


def _logout_handler(
    request: Request,
    response: Response,
    auth_service: Auth_Service,
) -> dict[str, str]:
    token = extraer_token_de_request(request)
    if token:
        auth_service.cerrar_sesion(token)
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"mensaje": "Sesión cerrada correctamente."}


# Endpoints en /api/seguridad
@seguridad_router.post("/login", response_model=Login_Response_DTO, status_code=status.HTTP_200_OK)
def login(
    body: Login_Request_DTO,
    response: Response,
    auth_service: Auth_Service = Depends(obtener_auth_service),
) -> Login_Response_DTO:
    return _login_handler(body, response, auth_service)


@seguridad_router.get("/me", response_model=Login_Response_DTO, status_code=status.HTTP_200_OK)
def me(
    datos_sesion: tuple[Usuario, Sesion] = Depends(obtener_sesion_actual),
) -> Login_Response_DTO:
    return _me_handler(datos_sesion)


@seguridad_router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    response: Response,
    auth_service: Auth_Service = Depends(obtener_auth_service),
) -> dict[str, str]:
    return _logout_handler(request, response, auth_service)


@seguridad_router.get("/usuarios", response_model=list[Usuario_Response_DTO], status_code=status.HTTP_200_OK)
def listar_usuarios(
    q: str = Query("", description="Búsqueda por nombre o login"),
    _usuario: Usuario = Depends(requerir_rol(ROL_ADMIN)),
    repo: Seguridad_Repository = Depends(obtener_seguridad_repository),
) -> list[Usuario_Response_DTO]:
    usuarios = repo.listar_usuarios(filtro=q if q.strip() else None)
    return [Seguridad_Mapper.usuario_a_dto(u) for u in usuarios]


@seguridad_router.post("/mutacion-protegida", status_code=status.HTTP_200_OK, dependencies=[Depends(validar_csrf)])
def mutacion_protegida(
    _usuario: Usuario = Depends(obtener_usuario_actual),
) -> dict[str, Any]:
    """Ruta protegida para verificar validación CSRF en operaciones mutantes."""
    return {"ok": True, "mensaje": "Mutación ejecutada con CSRF válido."}


@seguridad_router.get("/admin-only", status_code=status.HTTP_200_OK)
def admin_only(
    _usuario: Usuario = Depends(requerir_rol(ROL_ADMIN)),
) -> dict[str, str]:
    return {"mensaje": "Acceso permitido a administrador."}


@seguridad_router.get("/operador-only", status_code=status.HTTP_200_OK)
def operador_only(
    _usuario: Usuario = Depends(requerir_rol(ROL_OPERADOR)),
) -> dict[str, str]:
    return {"mensaje": "Acceso permitido a operador."}


# Espejo de compatibilidad en /api/auth
@auth_router.post("/login", response_model=Login_Response_DTO, status_code=status.HTTP_200_OK)
def auth_login(
    body: Login_Request_DTO,
    response: Response,
    auth_service: Auth_Service = Depends(obtener_auth_service),
) -> Login_Response_DTO:
    return _login_handler(body, response, auth_service)


@auth_router.get("/me", response_model=Login_Response_DTO, status_code=status.HTTP_200_OK)
def auth_me(
    datos_sesion: tuple[Usuario, Sesion] = Depends(obtener_sesion_actual),
) -> Login_Response_DTO:
    return _me_handler(datos_sesion)


@auth_router.post("/logout", status_code=status.HTTP_200_OK)
def auth_logout(
    request: Request,
    response: Response,
    auth_service: Auth_Service = Depends(obtener_auth_service),
) -> dict[str, str]:
    return _logout_handler(request, response, auth_service)
