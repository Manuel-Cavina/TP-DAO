"""Repositorio ORM para usuarios, asignaciones y sesiones."""

from __future__ import annotations

from datetime import datetime
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.seguridad.domain.usuario import Asignacion_Operador, Sesion, Usuario
from modules.seguridad.infrastructure.models import (
    Asignacion_Operador_Model,
    Sesion_Model,
    Usuario_Model,
)


def _modelo_a_asignacion(modelo: Asignacion_Operador_Model | None) -> Asignacion_Operador | None:
    if modelo is None:
        return None
    try:
        branch_ids = json.loads(modelo.authorised_branch_ids)
    except (ValueError, TypeError):
        branch_ids = []

    return Asignacion_Operador(
        id=modelo.id,
        usuario_id=modelo.usuario_id,
        reporting_cd_id=modelo.reporting_cd_id,
        authorised_branch_ids=branch_ids,
        shift_label=modelo.shift_label,
        activo=modelo.activo,
    )


def _modelo_a_usuario(modelo: Usuario_Model | None) -> Usuario | None:
    if modelo is None:
        return None
    asignacion = _modelo_a_asignacion(modelo.asignacion)
    return Usuario(
        id=modelo.id,
        nombre=modelo.nombre,
        login=modelo.login,
        password_hash=modelo.password_hash,
        rol=modelo.rol,
        activo=modelo.activo,
        asignacion=asignacion,
    )


def _modelo_a_sesion(modelo: Sesion_Model | None) -> Sesion | None:
    if modelo is None:
        return None
    return Sesion(
        id=modelo.id,
        token_hash=modelo.token_hash,
        usuario_id=modelo.usuario_id,
        csrf_token=modelo.csrf_token,
        creada_en=modelo.creada_en,
        expira_en=modelo.expira_en,
        revocada_en=modelo.revocada_en,
    )


class Seguridad_Repository:
    """Acceso a datos ORM para la capa de seguridad.

    Solo realiza select, add, delete y flush. No confirma ni cierra sesiones.
    """

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def buscar_usuario_por_login(self, login: str) -> Usuario | None:
        """Busca un usuario por su login normalizado."""
        session = self._get_session()
        stmt = select(Usuario_Model).where(Usuario_Model.login == login.strip().lower())
        modelo = session.scalar(stmt)
        return _modelo_a_usuario(modelo)

    def buscar_usuario_por_id(self, usuario_id: int) -> Usuario | None:
        """Busca un usuario por su ID primario."""
        session = self._get_session()
        stmt = select(Usuario_Model).where(Usuario_Model.id == usuario_id)
        modelo = session.scalar(stmt)
        return _modelo_a_usuario(modelo)

    def guardar_usuario(self, usuario: Usuario) -> Usuario:
        """Inserta o actualiza un usuario y su asignación operativa."""
        session = self._get_session()
        if usuario.id is not None:
            modelo = session.get(Usuario_Model, usuario.id)
            if modelo is None:
                modelo = Usuario_Model(id=usuario.id)
                session.add(modelo)
        else:
            modelo = Usuario_Model()
            session.add(modelo)

        modelo.nombre = usuario.nombre
        modelo.login = usuario.login.strip().lower()
        modelo.password_hash = usuario.password_hash
        modelo.rol = usuario.rol
        modelo.activo = usuario.activo

        if usuario.asignacion is not None:
            asig = usuario.asignacion
            branch_ids_json = json.dumps(asig.authorised_branch_ids)
            if modelo.asignacion is not None:
                modelo.asignacion.reporting_cd_id = asig.reporting_cd_id
                modelo.asignacion.authorised_branch_ids = branch_ids_json
                modelo.asignacion.shift_label = asig.shift_label
                modelo.asignacion.activo = asig.activo
            else:
                asig_modelo = Asignacion_Operador_Model(
                    reporting_cd_id=asig.reporting_cd_id,
                    authorised_branch_ids=branch_ids_json,
                    shift_label=asig.shift_label,
                    activo=asig.activo,
                )
                modelo.asignacion = asig_modelo

        session.flush()
        usuario.id = modelo.id
        if usuario.asignacion is not None and modelo.asignacion is not None:
            usuario.asignacion.id = modelo.asignacion.id
            usuario.asignacion.usuario_id = modelo.id

        return usuario

    def guardar_asignacion(self, asignacion: Asignacion_Operador) -> Asignacion_Operador:
        """Inserta o actualiza una asignación operativa."""
        session = self._get_session()
        branch_ids_json = json.dumps(asignacion.authorised_branch_ids)

        if asignacion.id is not None:
            modelo = session.get(Asignacion_Operador_Model, asignacion.id)
        elif asignacion.usuario_id is not None:
            stmt = select(Asignacion_Operador_Model).where(
                Asignacion_Operador_Model.usuario_id == asignacion.usuario_id
            )
            modelo = session.scalar(stmt)
        else:
            modelo = None

        if modelo is None:
            modelo = Asignacion_Operador_Model(usuario_id=asignacion.usuario_id)
            session.add(modelo)

        modelo.reporting_cd_id = asignacion.reporting_cd_id
        modelo.authorised_branch_ids = branch_ids_json
        modelo.shift_label = asignacion.shift_label
        modelo.activo = asignacion.activo

        session.flush()
        asignacion.id = modelo.id
        return asignacion

    def crear_sesion(self, sesion: Sesion) -> Sesion:
        """Persiste una nueva sesión."""
        session = self._get_session()
        modelo = Sesion_Model(
            token_hash=sesion.token_hash,
            usuario_id=sesion.usuario_id,
            csrf_token=sesion.csrf_token,
            creada_en=sesion.creada_en,
            expira_en=sesion.expira_en,
            revocada_en=sesion.revocada_en,
        )
        session.add(modelo)
        session.flush()
        sesion.id = modelo.id
        return sesion

    def buscar_sesion_por_token_hash(self, token_hash: str) -> tuple[Usuario, Sesion] | None:
        """Busca una sesión por el hash del token y retorna la tupla (Usuario, Sesion)."""
        session = self._get_session()
        stmt = select(Sesion_Model).where(Sesion_Model.token_hash == token_hash)
        modelo = session.scalar(stmt)
        if modelo is None or modelo.usuario is None:
            return None

        usuario = _modelo_a_usuario(modelo.usuario)
        sesion = _modelo_a_sesion(modelo)
        if usuario is None or sesion is None:
            return None
        return usuario, sesion

    def revocar_sesion(self, token_hash: str) -> None:
        """Revoca la sesión asociada al hash."""
        session = self._get_session()
        stmt = select(Sesion_Model).where(Sesion_Model.token_hash == token_hash)
        modelo = session.scalar(stmt)
        if modelo is not None and modelo.revocada_en is None:
            modelo.revocada_en = datetime.now()
            session.flush()

    def revocar_sesiones_usuario(self, usuario_id: int) -> None:
        """Revoca todas las sesiones activas de un usuario."""
        session = self._get_session()
        stmt = select(Sesion_Model).where(
            Sesion_Model.usuario_id == usuario_id,
            Sesion_Model.revocada_en.is_(None),
        )
        for modelo in session.scalars(stmt):
            modelo.revocada_en = datetime.now()
        session.flush()

    def listar_usuarios(self, filtro: str | None = None) -> list[Usuario]:
        """Lista usuarios, con filtro opcional por login o nombre."""
        session = self._get_session()
        stmt = select(Usuario_Model).order_by(Usuario_Model.id)
        if filtro:
            termino = f"%{filtro.strip().lower()}%"
            stmt = stmt.where(
                Usuario_Model.login.like(termino) | Usuario_Model.nombre.like(termino)
            )

        usuarios: list[Usuario] = []
        for modelo in session.scalars(stmt):
            usr = _modelo_a_usuario(modelo)
            if usr is not None:
                usuarios.append(usr)
        return usuarios
