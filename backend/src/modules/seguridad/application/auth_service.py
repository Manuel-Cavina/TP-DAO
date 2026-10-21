"""Servicio de autenticación, gestión de sesiones y control de credenciales."""

from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import os
import secrets

from modules.seguridad.domain.exceptions.seguridad_exceptions import (
    Credenciales_Invalidas_Exception,
    Csrf_Invalido_Exception,
    Sesion_Expirada_Exception,
    Sesion_Invalida_Exception,
    Usuario_Inactivo_Exception,
)
from modules.seguridad.domain.usuario import (
    ROL_ADMIN,
    ROL_OPERADOR,
    Asignacion_Operador,
    Sesion,
    Usuario,
)
from modules.seguridad.infrastructure.seguridad_repository import Seguridad_Repository


class Auth_Service:
    """Caso de uso de autenticación y sesiones del sistema."""

    ITERACIONES_PBKDF2 = 100_000
    DURACION_SESION_HORAS = 24

    def __init__(self, seguridad_repository: Seguridad_Repository | None = None) -> None:
        self._repo = seguridad_repository if seguridad_repository is not None else Seguridad_Repository()

    @classmethod
    def hashear_password(cls, password: str) -> str:
        """Calcula el hash PBKDF2-HMAC-SHA256 con salt aleatorio."""
        salt = secrets.token_hex(16)
        hash_bytes = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            cls.ITERACIONES_PBKDF2,
        )
        return f"{salt}${hash_bytes.hex()}"

    @classmethod
    def verificar_password(cls, password: str, password_hash: str) -> bool:
        """Verifica una contraseña contra su hash en tiempo constante."""
        if not password or not password_hash or "$" not in password_hash:
            return False

        try:
            salt, hash_guardado = password_hash.split("$", 1)
            hash_calculado = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                bytes.fromhex(salt),
                cls.ITERACIONES_PBKDF2,
            ).hex()
            return secrets.compare_digest(hash_calculado, hash_guardado)
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _calcular_token_hash(raw_token: str) -> str:
        """Genera el hash SHA-256 para persistencia de tokens de sesión."""
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    def autenticar(self, login: str, password: str) -> tuple[Usuario, Sesion, str]:
        """Autentica a un usuario y genera una sesión con tokens opacos y CSRF."""
        if not login or not password:
            raise Credenciales_Invalidas_Exception("Credenciales inválidas.")

        login_normalizado = login.strip().lower()
        usuario = self._repo.buscar_usuario_por_login(login_normalizado)
        if usuario is None:
            raise Credenciales_Invalidas_Exception("Credenciales inválidas.")

        if not self.verificar_password(password, usuario.password_hash):
            raise Credenciales_Invalidas_Exception("Credenciales inválidas.")

        if not usuario.activo:
            raise Usuario_Inactivo_Exception("El usuario se encuentra inactivo y no puede ingresar.")

        raw_token = secrets.token_urlsafe(32)
        token_hash = self._calcular_token_hash(raw_token)
        csrf_token = secrets.token_urlsafe(32)

        ahora = datetime.now()
        expira_en = ahora + timedelta(hours=self.DURACION_SESION_HORAS)

        sesion = Sesion(
            token_hash=token_hash,
            usuario_id=usuario.id,
            csrf_token=csrf_token,
            creada_en=ahora,
            expira_en=expira_en,
        )
        sesion = self._repo.crear_sesion(sesion)

        return usuario, sesion, raw_token

    def validar_sesion(self, raw_token: str, csrf_token: str | None = None) -> tuple[Usuario, Sesion]:
        """Valida la vigencia de una sesión y opcionalmente su token CSRF."""
        if not raw_token:
            raise Sesion_Invalida_Exception("Token de sesión ausente.")

        token_hash = self._calcular_token_hash(raw_token)
        resultado = self._repo.buscar_sesion_por_token_hash(token_hash)
        if resultado is None:
            raise Sesion_Invalida_Exception("Sesión inválida o inexistente.")

        usuario, sesion = resultado

        if sesion.revocada_en is not None:
            raise Sesion_Invalida_Exception("La sesión ha sido revocada.")

        if sesion.expira_en <= datetime.now():
            raise Sesion_Expirada_Exception("La sesión ha expirado.")

        if not usuario.activo:
            raise Usuario_Inactivo_Exception("El usuario vinculado a la sesión está inactivo.")

        if csrf_token is not None:
            if not secrets.compare_digest(sesion.csrf_token, csrf_token):
                raise Csrf_Invalido_Exception("Token CSRF inválido o no correspondiente a la sesión.")

        return usuario, sesion

    def cerrar_sesion(self, raw_token: str) -> None:
        """Revoca la sesión indicada por el token."""
        if not raw_token:
            return

        token_hash = self._calcular_token_hash(raw_token)
        self._repo.revocar_sesion(token_hash)

    def sembrar_identidades_defecto(self) -> dict[str, int]:
        """Siembra identidades iniciales requeridas de forma idempotente."""
        admin_login = "admin@stocky.local"
        admin_pass = os.getenv("STOCKY_ADMIN_PASSWORD", "stocky-demo")

        admin = self._repo.buscar_usuario_por_login(admin_login)
        if admin is None:
            admin = Usuario(
                nombre="Administrador Stocky",
                login=admin_login,
                password_hash=self.hashear_password(admin_pass),
                rol=ROL_ADMIN,
                activo=True,
            )
            self._repo.guardar_usuario(admin)

        operador_login = "operador@stocky.local"
        operador_pass = os.getenv("STOCKY_OPERADOR_PASSWORD", "stocky-demo")

        operador = self._repo.buscar_usuario_por_login(operador_login)
        if operador is None:
            asignacion = Asignacion_Operador(
                reporting_cd_id=1,
                authorised_branch_ids=[2],
                shift_label="Mañana",
                activo=True,
            )
            operador = Usuario(
                nombre="Operador Stocky",
                login=operador_login,
                password_hash=self.hashear_password(operador_pass),
                rol=ROL_OPERADOR,
                activo=True,
                asignacion=asignacion,
            )
            self._repo.guardar_usuario(operador)

        return {"usuarios_sembrados": 2}
