"""Modelos ORM de ventas, comprobantes y devoluciones.

producto_id y local_id son enteros que referencian a productos y ubicaciones de
Integrante 1. No declaran FK para no acoplar el esquema de ventas al de otro módulo;
la integridad la validan los servicios de catálogo y stock antes de vender.
"""

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from config.database.base import Base

DINERO = Numeric(12, 2, asdecimal=True)


class Venta_Model(Base):
    """Modelo ORM para la tabla ventas."""

    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    local_id = Column(Integer, nullable=False, index=True)
    fecha_hora = Column(DateTime, nullable=False, index=True)
    total = Column(DINERO, CheckConstraint("total > 0", name="ck_venta_total_positivo"), nullable=False)

    detalles = relationship(
        "Detalle_Venta_Model",
        back_populates="venta",
        cascade="all, delete-orphan",
        order_by="Detalle_Venta_Model.id",
        lazy="selectin",
    )
    comprobante = relationship(
        "Comprobante_Model",
        back_populates="venta",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="joined",
    )


class Detalle_Venta_Model(Base):
    """Modelo ORM para la tabla detalles_venta (precio histórico por línea)."""

    __tablename__ = "detalles_venta"
    __table_args__ = (
        UniqueConstraint("venta_id", "producto_id", name="uq_detalle_venta_producto"),
        CheckConstraint("cantidad > 0", name="ck_detalle_venta_cantidad"),
        CheckConstraint("precio_unitario > 0", name="ck_detalle_venta_precio"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    venta_id = Column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, nullable=False, index=True)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(DINERO, nullable=False)

    venta = relationship("Venta_Model", back_populates="detalles")


class Comprobante_Model(Base):
    """Modelo ORM para la tabla comprobantes, con numeración correlativa por local."""

    __tablename__ = "comprobantes"
    __table_args__ = (UniqueConstraint("local_id", "numero", name="uq_comprobante_local_numero"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    venta_id = Column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False, unique=True)
    local_id = Column(Integer, nullable=False)
    numero = Column(Integer, nullable=False)
    fecha_emision = Column(DateTime, nullable=False)
    total = Column(DINERO, nullable=False)
    medio_pago = Column(String(20), nullable=False, index=True)
    total_cobrado = Column(DINERO, nullable=False)
    recargo = Column(DINERO, nullable=False, default=0)
    vuelto = Column(DINERO, nullable=False, default=0)
    detalle_pago = Column(String(255), nullable=False, default="")

    venta = relationship("Venta_Model", back_populates="comprobante")


class Numerador_Comprobante_Model(Base):
    """Último número de comprobante emitido por local (talonario).

    Se incrementa con un UPDATE que toma el lock de escritura de SQLite: dos ventas
    concurrentes del mismo local se serializan y no repiten número.
    """

    __tablename__ = "numeradores_comprobante"

    local_id = Column(Integer, primary_key=True)
    ultimo_numero = Column(Integer, nullable=False, default=0)


class Devolucion_Model(Base):
    """Modelo ORM para la tabla devoluciones."""

    __tablename__ = "devoluciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False, index=True)
    local_id = Column(Integer, nullable=False, index=True)
    fecha_hora = Column(DateTime, nullable=False, index=True)
    motivo = Column(String(255), nullable=False)
    medio_pago = Column(String(20), nullable=False)
    monto_reintegrado = Column(DINERO, nullable=False)

    detalles = relationship(
        "Detalle_Devolucion_Model",
        back_populates="devolucion",
        cascade="all, delete-orphan",
        order_by="Detalle_Devolucion_Model.id",
        lazy="selectin",
    )


class Detalle_Devolucion_Model(Base):
    """Modelo ORM para la tabla detalles_devolucion; apunta a la línea original de la venta."""

    __tablename__ = "detalles_devolucion"
    __table_args__ = (CheckConstraint("cantidad > 0", name="ck_detalle_devolucion_cantidad"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    devolucion_id = Column(Integer, ForeignKey("devoluciones.id", ondelete="CASCADE"), nullable=False)
    detalle_venta_id = Column(Integer, ForeignKey("detalles_venta.id"), nullable=False)
    producto_id = Column(Integer, nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(DINERO, nullable=False)

    devolucion = relationship("Devolucion_Model", back_populates="detalles")
