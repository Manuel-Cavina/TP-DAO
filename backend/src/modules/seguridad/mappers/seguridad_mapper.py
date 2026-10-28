"""Mapeadores entre entidades de dominio y DTOs del módulo de seguridad."""

from modules.seguridad.domain.usuario import Asignacion_Operador, Sesion, Usuario
from modules.seguridad.dto.seguridad_dto import (
    Login_Response_DTO,
    Scope_Response_DTO,
    Sesion_Response_DTO,
    Usuario_Response_DTO,
)


class Seguridad_Mapper:
    """Mapeo bidireccional entre dominio y objetos de transferencia."""

    @staticmethod
    def usuario_a_dto(usuario: Usuario) -> Usuario_Response_DTO:
        return Usuario_Response_DTO(
            id=usuario.id or 0,
            name=usuario.nombre,
            login=usuario.login,
            role=usuario.rol,
            activo=usuario.activo,
        )

    @staticmethod
    def asignacion_a_scope_dto(asignacion: Asignacion_Operador | None) -> Scope_Response_DTO:
        if asignacion is None:
            return Scope_Response_DTO(reporting_cd_id=None, branch_ids=[], shift_label=None)
        return Scope_Response_DTO(
            reporting_cd_id=asignacion.reporting_cd_id,
            branch_ids=asignacion.authorised_branch_ids,
            shift_label=asignacion.shift_label,
        )

    @staticmethod
    def login_a_response_dto(usuario: Usuario, sesion: Sesion) -> Login_Response_DTO:
        return Login_Response_DTO(
            user=Seguridad_Mapper.usuario_a_dto(usuario),
            scope=Seguridad_Mapper.asignacion_a_scope_dto(usuario.asignacion),
            csrf_token=sesion.csrf_token,
        )

    @staticmethod
    def sesion_a_dto(sesion: Sesion) -> Sesion_Response_DTO:
        return Sesion_Response_DTO(
            id=sesion.id,
            usuario_id=sesion.usuario_id,
            csrf_token=sesion.csrf_token,
            creada_en=sesion.creada_en,
            expira_en=sesion.expira_en,
            activa=sesion.esta_activa(),
        )
