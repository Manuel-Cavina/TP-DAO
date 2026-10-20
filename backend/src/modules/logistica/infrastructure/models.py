"""Modelos ORM de logistica.

producto_id, origen_id, destino_id y local_id son enteros que referencian a
productos y ubicaciones de Integrante 1. No declaran FK para no acoplar el esquema
de logistica al de otro modulo; la integridad la validan los servicios de Integrante 1.
"""

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from config.database.base import Base


class Precinto_Model(Base):
    """Modelo ORM para la tabla precintos."""

    __tablename__ = "precintos"

    codigo = Column(String(50), primary_key=True)
    esta_intacto = Column(Boolean, nullable=False, default=True)
    utilizado = Column(Boolean, nullable=False, default=False)


class Orden_Reposicion_Model(Base):
    """Modelo ORM para la tabla ordenes_reposicion."""

    __tablename__ = "ordenes_reposicion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    origen_id = Column(Integer, nullable=False, index=True)
    destino_id = Column(Integer, nullable=False, index=True)
    fecha = Column(DateTime, nullable=False, default=datetime.now)
    estado = Column(String(20), nullable=False, default="PENDIENTE")

    detalles = relationship(
        "Detalle_Orden_Reposicion_Model",
        back_populates="orden",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    bultos = relationship("Bulto_Model", back_populates="orden", lazy="select")


class Detalle_Orden_Reposicion_Model(Base):
    """Modelo ORM para la tabla detalles_orden_reposicion."""

    __tablename__ = "detalles_orden_reposicion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    orden_id = Column(Integer, ForeignKey("ordenes_reposicion.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, nullable=False, index=True)
    cantidad_solicitada = Column(Integer, nullable=False)
    cantidad_enviada = Column(Integer, nullable=False, default=0)

    orden = relationship("Orden_Reposicion_Model", back_populates="detalles")


class Remito_Model(Base):
    """Modelo ORM para la tabla remitos."""

    __tablename__ = "remitos"

    numero = Column(String(50), primary_key=True)
    origen_id = Column(Integer, nullable=False, index=True)
    destino_id = Column(Integer, nullable=False, index=True)
    fecha_emision = Column(DateTime, nullable=False, default=datetime.now)
    estado = Column(String(20), nullable=False, default="EMITIDO")

    bultos = relationship("Bulto_Model", back_populates="remito", lazy="select")


class Bulto_Model(Base):
    """Modelo ORM para la tabla bultos."""

    __tablename__ = "bultos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    orden_id = Column(Integer, ForeignKey("ordenes_reposicion.id"), nullable=False)
    remito_numero = Column(String(50), ForeignKey("remitos.numero"), nullable=True)
    codigo_precinto = Column(String(50), ForeignKey("precintos.codigo"), nullable=True)
    estado = Column(String(20), nullable=False, default="PREPARADO")

    orden = relationship("Orden_Reposicion_Model", back_populates="bultos")
    remito = relationship("Remito_Model", back_populates="bultos")
    precinto = relationship("Precinto_Model", lazy="joined")
    detalles = relationship(
        "Detalle_Bulto_Model",
        back_populates="bulto",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    historial = relationship(
        "Historial_Bulto_Model",
        back_populates="bulto",
        cascade="all, delete-orphan",
        order_by="Historial_Bulto_Model.id",
        lazy="joined",
    )


class Detalle_Bulto_Model(Base):
    """Modelo ORM para la tabla detalles_bulto."""

    __tablename__ = "detalles_bulto"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bulto_id = Column(Integer, ForeignKey("bultos.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, nullable=False, index=True)
    cantidad = Column(Integer, nullable=False)

    bulto = relationship("Bulto_Model", back_populates="detalles")


class Historial_Bulto_Model(Base):
    """Modelo ORM para la tabla historial_bultos (trazabilidad inmutable)."""

    __tablename__ = "historial_bultos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bulto_id = Column(Integer, ForeignKey("bultos.id"), nullable=False)
    estado_anterior = Column(String(20), nullable=False)
    estado_nuevo = Column(String(20), nullable=False)
    fecha_hora = Column(DateTime, nullable=False, default=datetime.now)
    observacion = Column(String(255), nullable=False, default="")

    bulto = relationship("Bulto_Model", back_populates="historial")


class Necesidad_Reposicion_Model(Base):
    """Modelo ORM para la tabla necesidades_reposicion."""

    __tablename__ = "necesidades_reposicion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    producto_id = Column(Integer, nullable=False, index=True)
    local_id = Column(Integer, nullable=False, index=True)
    cantidad = Column(Integer, nullable=False)
    estado = Column(String(20), nullable=False, default="PENDIENTE")
    orden_id = Column(Integer, ForeignKey("ordenes_reposicion.id"), nullable=True)
    fecha_registro = Column(DateTime, nullable=False, default=datetime.now)
