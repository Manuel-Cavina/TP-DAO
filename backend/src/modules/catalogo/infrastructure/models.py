"""Modelos ORM del catálogo: fuente de verdad de categorias, proveedores y productos."""

from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, Numeric, String, text

from config.database.base import Base

DINERO = Numeric(12, 2, asdecimal=True)


class Categoria_Model(Base):
    """Modelo ORM para la tabla categorias."""

    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    activo = Column(Boolean, nullable=False, default=True, server_default=text("1"))


class Proveedor_Model(Base):
    """Modelo ORM para la tabla proveedores. El CUIT es único (V4)."""

    __tablename__ = "proveedores"
    __table_args__ = (
        CheckConstraint("length(cuit) = 11 AND cuit NOT GLOB '*[^0-9]*'", name="ck_proveedor_cuit"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    cuit = Column(String(11), nullable=False, unique=True)
    razon_social = Column(String(150), nullable=False)
    telefono = Column(String(50), nullable=False)
    email = Column(String(150), nullable=False)
    activo = Column(Boolean, nullable=False, default=True, server_default=text("1"))


class Producto_Model(Base):
    """Modelo ORM para la tabla productos. El código es único (V4)."""

    __tablename__ = "productos"
    __table_args__ = (
        CheckConstraint("precio_venta > 0", name="ck_producto_precio"),
        CheckConstraint("costo_unitario > 0", name="ck_producto_costo"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(50), nullable=False, unique=True)
    nombre = Column(String(150), nullable=False)
    precio_venta = Column(DINERO, nullable=False)
    costo_unitario = Column(DINERO, nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=False, index=True)
    activo = Column(Boolean, nullable=False, default=True, server_default=text("1"))
