"""Modelos ORM de SQLAlchemy para el módulo de seguridad."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from config.database.base import Base


class Usuario_Model(Base):
    """Modelo ORM para la tabla usuarios."""

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    login = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False, default="OPERADOR")
    activo = Column(Boolean, nullable=False, default=True)

    asignacion = relationship(
        "Asignacion_Operador_Model",
        back_populates="usuario",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )
    sesiones = relationship(
        "Sesion_Model",
        back_populates="usuario",
        cascade="all, delete-orphan",
        lazy="select",
    )


class Asignacion_Operador_Model(Base):
    """Modelo ORM para la tabla asignaciones_operador."""

    __tablename__ = "asignaciones_operador"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), unique=True, nullable=False)
    reporting_cd_id = Column(Integer, nullable=True)
    authorised_branch_ids = Column(Text, nullable=False, default="[]")
    shift_label = Column(String(50), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)

    usuario = relationship("Usuario_Model", back_populates="asignacion")


class Sesion_Model(Base):
    """Modelo ORM para la tabla sesiones."""

    __tablename__ = "sesiones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    csrf_token = Column(String(64), nullable=False)
    creada_en = Column(DateTime, nullable=False, default=datetime.now)
    expira_en = Column(DateTime, nullable=False)
    revocada_en = Column(DateTime, nullable=True)

    usuario = relationship("Usuario_Model", back_populates="sesiones", lazy="joined")
