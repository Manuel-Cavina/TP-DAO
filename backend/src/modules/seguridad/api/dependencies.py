"""Dependencias FastAPI para autenticación, autorización y protección CSRF."""

from __future__ import annotations

from typing import Callable

from fastapi import Depends, Request

from modules.seguridad.application.auth_service import Auth_Service
from modules.seguridad.domain.exceptions.seguridad_exceptions import (
    Csrf_Invalido_Exception,
    Permiso_Insuficiente_Exception,
    Sesion_Invalida_Exception,
)
from modules.seguridad.domain.usuario import ROL_ADMIN, ROL_OPERADOR, Sesion, Usuario
from modules.seguridad.infrastructure.seguridad_repository import Seguridad_Repository

COOKIE_NAME = "stocky_session"


def obtener_seguridad_repository() -> Seguridad_Repository:
    """Provee el repositorio de seguridad."""
    return Seguridad_Repository()


def obtener_auth_service(
    repo: Seguridad_Repository = Depends(obtener_seguridad_repository),
) -> Auth_Service:
    """Provee el servicio de autenticación."""
    return Auth_Service(seguridad_repository=repo)


def extraer_token_de_request(request: Request) -> str | None:
    """Extrae el token opaco desde la cookie HttpOnly o el encabezado Authorization Bearer."""
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        return cookie_token

    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        partes = auth_header.split(" ", 1)
        if len(partes) == 2 and partes[1].strip():
            return partes[1].strip()

    return None


def obtener_usuario_actual(
    request: Request,
    auth_service: Auth_Service = Depends(obtener_auth_service),
) -> Usuario:
    """Extrae token de cookie o Bearer y valida vigencia de la sesión."""
    token = extraer_token_de_request(request)
    if not token:
        raise Sesion_Invalida_Exception("No se proporcionó token de sesión.")

    usuario, sesion = auth_service.validar_sesion(token)
    request.state.usuario = usuario
    request.state.sesion = sesion
    request.state.raw_token = token
    return usuario


def obtener_sesion_actual(
    request: Request,
    auth_service: Auth_Service = Depends(obtener_auth_service),
) -> tuple[Usuario, Sesion]:
    """Retorna la tupla de usuario y sesión activa."""
    token = extraer_token_de_request(request)
    if not token:
        raise Sesion_Invalida_Exception("No se proporcionó token de sesión.")

    usuario, sesion = auth_service.validar_sesion(token)
    request.state.usuario = usuario
    request.state.sesion = sesion
    request.state.raw_token = token
    return usuario, sesion


def requerir_rol(rol: str) -> Callable[[Usuario], Usuario]:
    """Valida que el usuario tenga el rol solicitado o que ADMIN herede acceso total."""
    rol_esperado = rol.upper()

    def _verificador(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
        if usuario.rol == ROL_ADMIN:
            return usuario

        if usuario.rol != rol_esperado:
            raise Permiso_Insuficiente_Exception(
                f"Acceso denegado: se requiere rol '{rol_esperado}' pero el usuario tiene '{usuario.rol}'."
            )
        return usuario

    return _verificador


def validar_csrf(
    request: Request,
    auth_service: Auth_Service = Depends(obtener_auth_service),
) -> None:
    """Valida header X-CSRF-Token contra la sesión activa en operaciones de mutación."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        csrf_token = request.headers.get("X-CSRF-Token") or request.headers.get("x-csrf-token")
        if not csrf_token:
            raise Csrf_Invalido_Exception("Falta encabezado X-CSRF-Token requerido para esta operación.")

        token = extraer_token_de_request(request)
        if not token:
            raise Sesion_Invalida_Exception("No se proporcionó token de sesión para validar CSRF.")

        auth_service.validar_sesion(token, csrf_token=csrf_token)


def validar_alcance_operador(usuario: Usuario, ubicacion_id: int | None) -> None:
    """Valida que el usuario tenga alcance operativo sobre la ubicación solicitada (T055)."""
    if usuario.rol == ROL_ADMIN:
        return

    if usuario.rol == ROL_OPERADOR:
        if ubicacion_id is None:
            raise Permiso_Insuficiente_Exception(
                "No se especificó una ubicación válida para el alcance del operador."
            )
        if usuario.asignacion is not None and usuario.asignacion.puede_operar(ubicacion_id):
            return
        raise Permiso_Insuficiente_Exception(
            f"Acceso denegado: la ubicación {ubicacion_id} está fuera del alcance asignado al operador."
        )
