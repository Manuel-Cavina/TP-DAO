from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column

from config.database.base import Base
from modules.ubicaciones_stock.domain.exceptions import Datos_Invalidos_Exception

if "productos" not in Base.metadata.tables:
    Table("productos", Base.metadata, Column("id", Integer, primary_key=True), extend_existing=True)

if "stocks" not in Base.metadata.tables:
    Table("stocks", Base.metadata, Column("id", Integer, primary_key=True), extend_existing=True)


class Alerta_Stock(Base):
    """Entidad ORM que representa una alerta emitida ante stock crítico."""

    __tablename__ = "alertas_stock"
    __table_args__ = (
        CheckConstraint("leida IN (0, 1)", name="ck_alertas_stock_leida"),
        {"extend_existing": True},
    )

    id: Mapped[int | None] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(Integer, ForeignKey("stocks.id"), nullable=False)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos.id"), nullable=False)
    ubicacion_id: Mapped[int] = mapped_column(Integer, ForeignKey("ubicaciones.id"), nullable=False)
    cantidad_disponible: Mapped[int] = mapped_column(Integer, nullable=False)
    nivel_minimo: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_emision: Mapped[str] = mapped_column(String, nullable=False)
    leida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __init__(
        self,
        stock_id: int,
        producto_id: int,
        ubicacion_id: int,
        cantidad_disponible: int,
        nivel_minimo: int,
        fecha_emision: str,
        id: int | None = None,
        leida: bool = False,
    ) -> None:
        if stock_id <= 0:
            raise Datos_Invalidos_Exception("El ID de stock es inválido.")
        if producto_id <= 0:
            raise Datos_Invalidos_Exception("El ID de producto es inválido.")
        if ubicacion_id <= 0:
            raise Datos_Invalidos_Exception("El ID de ubicación es inválido.")
        if cantidad_disponible < 0:
            raise Datos_Invalidos_Exception("La cantidad disponible no puede ser negativa.")
        if nivel_minimo <= 0:
            raise Datos_Invalidos_Exception("El nivel mínimo de existencia debe ser mayor a cero.")
        if not fecha_emision or not fecha_emision.strip():
            raise Datos_Invalidos_Exception("La fecha de emisión no puede estar vacía.")

        if id is not None:
            self.id = id
        self.stock_id = stock_id
        self.producto_id = producto_id
        self.ubicacion_id = ubicacion_id
        self.cantidad_disponible = cantidad_disponible
        self.nivel_minimo = nivel_minimo
        self.fecha_emision = fecha_emision.strip()
        self.leida = bool(leida)

    def marcar_como_leida(self) -> None:
        """Marca la alerta como leída."""
        self.leida = True
