"""Entidades de dominio del módulo de seguridad."""

from __future__ import annotations

from datetime import datetime

from modules.seguridad.domain.exceptions.seguridad_exceptions import Permiso_Insuficiente_Exception

ROL_ADMIN = "ADMIN"
ROL_OPERADOR = "OPERADOR"
ROLES_VALIDOS = {ROL_ADMIN, ROL_OPERADOR}


class Asignacion_Operador:
    """Asignación de alcance operativo para usuarios con rol OPERADOR."""

    def __init__(
        self,
        id: int | None = None,
        usuario_id: int | None = None,
        reporting_cd_id: int | None = None,
        authorised_branch_ids: list[int] | None = None,
        shift_label: str | None = None,
        activo: bool = True,
    ) -> None:
        self._id = id
        self._usuario_id = usuario_id
        self._reporting_cd_id = reporting_cd_id
        self._authorised_branch_ids = list(authorised_branch_ids) if authorised_branch_ids is not None else []
        self._shift_label = shift_label
        self._activo = activo

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, value: int | None) -> None:
        self._id = value

    @property
    def usuario_id(self) -> int | None:
        return self._usuario_id

    @usuario_id.setter
    def usuario_id(self, value: int | None) -> None:
        self._usuario_id = value

    @property
    def reporting_cd_id(self) -> int | None:
        return self._reporting_cd_id

    @property
    def authorised_branch_ids(self) -> list[int]:
        return list(self._authorised_branch_ids)

    @property
    def shift_label(self) -> str | None:
        return self._shift_label

    @property
    def activo(self) -> bool:
        return self._activo

    def puede_operar_en_origen(self, origen_id: int) -> bool:
        """Verifica si el operador está habilitado para operar en el CD de origen."""
        return self._reporting_cd_id == origen_id

    def puede_operar_en_destino(self, destino_id: int) -> bool:
        """Verifica si el operador está habilitado para operar en el local de destino."""
        return destino_id in self._authorised_branch_ids

    def puede_operar(self, ubicacion_id: int) -> bool:
        """Verifica si la ubicación pertenece al alcance del operador."""
        if not self._activo:
            return False
        return self.puede_operar_en_origen(ubicacion_id) or self.puede_operar_en_destino(ubicacion_id)


class Sesion:
    """Sesión activa opaca en el servidor."""

    def __init__(
        self,
        token_hash: str,
        usuario_id: int,
        csrf_token: str,
        creada_en: datetime,
        expira_en: datetime,
        id: int | None = None,
        revocada_en: datetime | None = None,
    ) -> None:
        self._id = id
        self._token_hash = token_hash
        self._usuario_id = usuario_id
        self._csrf_token = csrf_token
        self._creada_en = creada_en
        self._expira_en = expira_en
        self._revocada_en = revocada_en

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, value: int | None) -> None:
        self._id = value

    @property
    def token_hash(self) -> str:
        return self._token_hash

    @property
    def usuario_id(self) -> int:
        return self._usuario_id

    @property
    def csrf_token(self) -> str:
        return self._csrf_token

    @property
    def creada_en(self) -> datetime:
        return self._creada_en

    @property
    def expira_en(self) -> datetime:
        return self._expira_en

    @property
    def revocada_en(self) -> datetime | None:
        return self._revocada_en

    def esta_activa(self, momento: datetime | None = None) -> bool:
        """Indica si la sesión no ha sido revocada ni ha expirado."""
        ahora = momento or datetime.now()
        return self._revocada_en is None and self._expira_en > ahora

    def revocar(self, momento: datetime | None = None) -> None:
        """Revoca la sesión de forma inmediata."""
        self._revocada_en = momento or datetime.now()


class Usuario:
    """Entidad de usuario del sistema."""

    def __init__(
        self,
        nombre: str,
        login: str,
        password_hash: str,
        rol: str = ROL_OPERADOR,
        id: int | None = None,
        activo: bool = True,
        asignacion: Asignacion_Operador | None = None,
    ) -> None:
        rol_normalizado = rol.upper()
        if rol_normalizado not in ROLES_VALIDOS:
            raise Permiso_Insuficiente_Exception(
                f"Rol inválido: '{rol}'. Los roles permitidos son: {', '.join(sorted(ROLES_VALIDOS))}."
            )

        login_limpio = login.strip().lower()
        if not login_limpio:
            raise ValueError("El login del usuario no puede estar vacío.")

        nombre_limpio = nombre.strip()
        if not nombre_limpio:
            raise ValueError("El nombre del usuario no puede estar vacío.")

        self._id = id
        self._nombre = nombre_limpio
        self._login = login_limpio
        self._password_hash = password_hash
        self._rol = rol_normalizado
        self._activo = activo
        self._asignacion = asignacion

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, value: int | None) -> None:
        self._id = value

    @property
    def nombre(self) -> str:
        return self._nombre

    @nombre.setter
    def nombre(self, value: str) -> None:
        limpio = value.strip()
        if not limpio:
            raise ValueError("El nombre no puede estar vacío.")
        self._nombre = limpio

    @property
    def login(self) -> str:
        return self._login

    @property
    def password_hash(self) -> str:
        return self._password_hash

    @password_hash.setter
    def password_hash(self, value: str) -> None:
        if not value:
            raise ValueError("El password hash no puede estar vacío.")
        self._password_hash = value

    @property
    def rol(self) -> str:
        return self._rol

    @property
    def activo(self) -> bool:
        return self._activo

    @activo.setter
    def activo(self, value: bool) -> None:
        self._activo = bool(value)

    @property
    def asignacion(self) -> Asignacion_Operador | None:
        return self._asignacion

    @asignacion.setter
    def asignacion(self, value: Asignacion_Operador | None) -> None:
        self._asignacion = value

    def es_admin(self) -> bool:
        return self._rol == ROL_ADMIN

    def es_operador(self) -> bool:
        return self._rol == ROL_OPERADOR

    def desactivar(self) -> None:
        self._activo = False

    def activar(self) -> None:
        self._activo = True
