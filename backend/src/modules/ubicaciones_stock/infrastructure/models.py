"""Modelos ORM de ubicaciones, stock y alertas: fuente de verdad de esas tablas."""

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, text

from config.database.base import Base


class Ubicacion_Model(Base):
    """Modelo ORM para la tabla ubicaciones (CD y locales en una sola tabla, por tipo)."""

    __tablename__ = "ubicaciones"
    __table_args__ = (
        CheckConstraint("tipo IN ('CD', 'LOCAL')", name="ck_ubicacion_tipo"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String(10), nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    direccion = Column(String(255), nullable=False)
    telefono = Column(String(50), nullable=True)
    activo = Column(Boolean, nullable=False, default=True, server_default=text("1"))


class Stock_Model(Base):
    """Modelo ORM para la tabla stocks: un registro por par producto-ubicación."""

    __tablename__ = "stocks"
    __table_args__ = (
        UniqueConstraint("producto_id", "ubicacion_id", name="uq_stock_producto_ubicacion"),
        CheckConstraint("cantidad_disponible >= 0", name="ck_stock_disponible"),
        CheckConstraint("cantidad_en_transito >= 0", name="ck_stock_transito"),
        CheckConstraint("nivel_minimo_existencia > 0", name="ck_stock_minimo"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False, index=True)
    ubicacion_id = Column(Integer, ForeignKey("ubicaciones.id"), nullable=False, index=True)
    cantidad_disponible = Column(Integer, nullable=False, default=0, server_default=text("0"))
    cantidad_en_transito = Column(Integer, nullable=False, default=0, server_default=text("0"))
    nivel_minimo_existencia = Column(Integer, nullable=False, default=1, server_default=text("1"))


class Alerta_Stock_Model(Base):
    """Modelo ORM para la tabla alertas_stock (generadas por el Observer)."""

    __tablename__ = "alertas_stock"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    ubicacion_id = Column(Integer, ForeignKey("ubicaciones.id"), nullable=False)
    cantidad_disponible = Column(Integer, nullable=False)
    nivel_minimo = Column(Integer, nullable=False)
    fecha_emision = Column(DateTime, nullable=False)
    leida = Column(Boolean, nullable=False, default=False, server_default=text("0"))
