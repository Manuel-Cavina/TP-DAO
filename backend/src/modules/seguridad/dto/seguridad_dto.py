"""DTOs de entrada y salida para el módulo de seguridad."""

from datetime import datetime

from pydantic import BaseModel, Field


class Login_Request_DTO(BaseModel):
    """Petición de inicio de sesión."""

    login: str = Field(..., min_length=1, description="Nombre de usuario o correo electrónico")
    password: str = Field(..., min_length=1, description="Contraseña en texto plano")


LoginRequest = Login_Request_DTO


class Scope_Response_DTO(BaseModel):
    """Alcance y asignación operativa del usuario."""

    reporting_cd_id: int | None = None
    branch_ids: list[int] = Field(default_factory=list)
    shift_label: str | None = None


ScopeResponse = Scope_Response_DTO


class Usuario_Response_DTO(BaseModel):
    """Datos públicos del usuario autenticado."""

    id: int
    name: str
    login: str
    role: str
    activo: bool = True


UsuarioResponse = Usuario_Response_DTO


class Login_Response_DTO(BaseModel):
    """Respuesta exitosa de autenticación y consulta de identidad."""

    user: Usuario_Response_DTO
    scope: Scope_Response_DTO
    csrf_token: str


LoginResponse = Login_Response_DTO


class Sesion_Response_DTO(BaseModel):
    """Metadatos de sesión persistida."""

    id: int | None = None
    usuario_id: int
    csrf_token: str
    creada_en: datetime
    expira_en: datetime
    activa: bool = True


SesionResponse = Sesion_Response_DTO
