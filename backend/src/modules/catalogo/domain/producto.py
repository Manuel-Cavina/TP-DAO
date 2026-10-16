from typing import TYPE_CHECKING

from config.database.base import Base
from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception

if TYPE_CHECKING:
    from modules.catalogo.domain.categoria import Categoria
    from modules.catalogo.domain.proveedor import Proveedor


class Producto(Base):
    """Entidad de dominio que representa un artículo comercializable."""

    __tablename__ = "productos"
    __table_args__ = (
        CheckConstraint("precio_venta > 0", name="chk_producto_precio_venta"),
        CheckConstraint("costo_unitario > 0", name="chk_producto_costo_unitario"),
        CheckConstraint("activo IN (0, 1)", name="chk_producto_activo"),
    )

    id: Mapped[int | None] = mapped_column(Integer, primary_key=True, autoincrement=True, default=None)
    codigo: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    precio_venta: Mapped[float] = mapped_column(Float, nullable=False)
    costo_unitario: Mapped[float] = mapped_column(Float, nullable=False)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"), nullable=False)
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id"), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    categoria: Mapped["Categoria"] = relationship("Categoria", back_populates="productos")
    proveedor: Mapped["Proveedor"] = relationship("Proveedor", back_populates="productos")

    def __init__(
        self,
        codigo: str,
        nombre: str,
        precio_venta: float,
        costo_unitario: float,
        categoria_id: int,
        proveedor_id: int,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        if not codigo or not codigo.strip():
            raise Datos_Invalidos_Exception("El código del producto no puede estar vacío.")
        if not nombre or not nombre.strip():
            raise Datos_Invalidos_Exception("El nombre del producto no puede estar vacío.")
        if precio_venta <= 0:
            raise Datos_Invalidos_Exception("El precio de venta debe ser mayor a cero.")
        if costo_unitario <= 0:
            raise Datos_Invalidos_Exception("El costo unitario debe ser mayor a cero.")
        if categoria_id <= 0:
            raise Datos_Invalidos_Exception("El ID de categoría es inválido.")
        if proveedor_id <= 0:
            raise Datos_Invalidos_Exception("El ID de proveedor es inválido.")

        self.id = id
        self.codigo = codigo.strip()
        self.nombre = nombre.strip()
        self.precio_venta = float(precio_venta)
        self.costo_unitario = float(costo_unitario)
        self.categoria_id = categoria_id
        self.proveedor_id = proveedor_id
        self.activo = activo

    @validates("codigo")
    def _validar_codigo(self, key: str, value: str) -> str:
        if not value or not value.strip():
            raise Datos_Invalidos_Exception("El código del producto no puede estar vacío.")
        return value.strip()

    @validates("nombre")
    def _validar_nombre(self, key: str, value: str) -> str:
        if not value or not value.strip():
            raise Datos_Invalidos_Exception("El nombre del producto no puede estar vacío.")
        return value.strip()

    @validates("precio_venta")
    def _validar_precio_venta(self, key: str, value: float) -> float:
        val = float(value)
        if val <= 0:
            raise Datos_Invalidos_Exception("El precio de venta debe ser mayor a cero.")
        return val

    @validates("costo_unitario")
    def _validar_costo_unitario(self, key: str, value: float) -> float:
        val = float(value)
        if val <= 0:
            raise Datos_Invalidos_Exception("El costo unitario debe ser mayor a cero.")
        return val

    @validates("categoria_id")
    def _validar_categoria_id(self, key: str, value: int) -> int:
        if value <= 0:
            raise Datos_Invalidos_Exception("El ID de categoría es inválido.")
        return value

    @validates("proveedor_id")
    def _validar_proveedor_id(self, key: str, value: int) -> int:
        if value <= 0:
            raise Datos_Invalidos_Exception("El ID de proveedor es inválido.")
        return value

    def actualizar_precio(self, nuevo_precio: float) -> None:
        """Actualiza el precio de venta para ventas futuras sin afectar las ya registradas."""
        self.precio_venta = nuevo_precio

    def desactivar(self) -> None:
        """Da de baja lógica al producto."""
        self.activo = False

    def activar(self) -> None:
        """Reactiva al producto."""
        self.activo = True
