from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, reconstructor, relationship, validates

from config.database.base import Base
from modules.ubicaciones_stock.domain.exceptions import (
    Datos_Invalidos_Exception,
    Stock_Insuficiente_Exception,
)
from modules.ubicaciones_stock.domain.observers import Stock_Observer
from modules.ubicaciones_stock.domain.ubicacion import Ubicacion

if "productos" not in Base.metadata.tables:
    Table("productos", Base.metadata, Column("id", Integer, primary_key=True), extend_existing=True)


class Stock(Base):
    """Entidad ORM que gestiona existencias por producto y ubicación física."""

    __tablename__ = "stocks"
    __table_args__ = (
        UniqueConstraint("producto_id", "ubicacion_id", name="uq_stock_producto_ubicacion"),
        CheckConstraint("cantidad_disponible >= 0", name="ck_stock_cantidad_disponible"),
        CheckConstraint("cantidad_en_transito >= 0", name="ck_stock_cantidad_en_transito"),
        CheckConstraint("nivel_minimo_existencia > 0", name="ck_stock_nivel_minimo"),
        {"extend_existing": True},
    )

    id: Mapped[int | None] = mapped_column(Integer, primary_key=True, autoincrement=True)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos.id"), nullable=False)
    ubicacion_id: Mapped[int] = mapped_column(Integer, ForeignKey("ubicaciones.id"), nullable=False)
    cantidad_disponible: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cantidad_en_transito: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nivel_minimo_existencia: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    ubicacion: Mapped[Ubicacion | None] = relationship("Ubicacion", foreign_keys=[ubicacion_id], lazy="joined")

    def __init__(
        self,
        producto_id: int,
        ubicacion_id: int,
        cantidad_disponible: int = 0,
        cantidad_en_transito: int = 0,
        nivel_minimo_existencia: int = 1,
        id: int | None = None,
        ubicacion: Ubicacion | None = None,
    ) -> None:
        if producto_id <= 0:
            raise Datos_Invalidos_Exception("El ID de producto es inválido.")
        if ubicacion_id <= 0:
            raise Datos_Invalidos_Exception("El ID de ubicación es inválido.")
        if cantidad_disponible < 0:
            raise Datos_Invalidos_Exception("La cantidad disponible no puede ser negativa.")
        if cantidad_en_transito < 0:
            raise Datos_Invalidos_Exception("La cantidad en tránsito no puede ser negativa.")
        if nivel_minimo_existencia <= 0:
            raise Datos_Invalidos_Exception("El nivel mínimo de existencia debe ser mayor a cero.")

        if id is not None:
            self.id = id
        self.producto_id = producto_id
        self.ubicacion_id = ubicacion_id
        self.cantidad_disponible = cantidad_disponible
        self.cantidad_en_transito = cantidad_en_transito
        self.nivel_minimo_existencia = nivel_minimo_existencia
        if ubicacion is not None:
            self.ubicacion = ubicacion
        self._observadores: list[Stock_Observer] = []

    @reconstructor
    def _init_on_load(self) -> None:
        self._observadores = []

    @property
    def observadores(self) -> list[Stock_Observer]:
        if not hasattr(self, "_observadores"):
            self._observadores = []
        return self._observadores

    def agregar_observador(self, obs: Stock_Observer) -> None:
        if obs not in self.observadores:
            self.observadores.append(obs)

    def eliminar_observador(self, obs: Stock_Observer) -> None:
        if obs in self.observadores:
            self.observadores.remove(obs)

    def notificar(self) -> None:
        for obs in list(self.observadores):
            obs.notificar_stock_bajo(self)

    @validates("nivel_minimo_existencia")
    def _validar_nivel_minimo(self, key: str, value: int) -> int:
        if value <= 0:
            raise Datos_Invalidos_Exception("El nivel mínimo de existencia debe ser mayor a cero.")
        return value

    def incrementar_disponible(self, cantidad: int) -> None:
        """Añade unidades disponibles (ej. recepción en CD o reingreso de devolución)."""
        if cantidad <= 0:
            raise Datos_Invalidos_Exception("La cantidad a incrementar debe ser mayor a cero.")
        self.cantidad_disponible += cantidad

    def reingresar_disponible(self, cantidad: int) -> None:
        """Reingresa unidades al stock disponible por devolución de venta."""
        self.incrementar_disponible(cantidad)

    def descontar_disponible(self, cantidad: int) -> None:
        """Descuenta unidades disponibles (ej. reserva para despacho CD o venta en local)."""
        if cantidad <= 0:
            raise Datos_Invalidos_Exception("La cantidad a descontar debe ser mayor a cero.")
        if self.cantidad_disponible < cantidad:
            raise Stock_Insuficiente_Exception(
                f"Stock insuficiente: disponible={self.cantidad_disponible}, solicitado={cantidad}."
            )
        self.cantidad_disponible -= cantidad
        if self.esta_en_o_bajo_minimo():
            self.notificar()

    def mover_a_transito(self, cantidad: int) -> None:
        """Suma unidades en tránsito en el local receptor durante el despacho del CD."""
        if cantidad <= 0:
            raise Datos_Invalidos_Exception("La cantidad en tránsito debe ser mayor a cero.")
        self.cantidad_en_transito += cantidad

    def acreditar_desde_transito(self, cantidad: int) -> None:
        """Pasa unidades de tránsito a disponible al verificar intacto el precinto del bulto."""
        if cantidad <= 0:
            raise Datos_Invalidos_Exception("La cantidad a acreditar debe ser mayor a cero.")
        if self.cantidad_en_transito < cantidad:
            raise Stock_Insuficiente_Exception(
                f"Tránsito insuficiente: en tránsito={self.cantidad_en_transito}, solicitado={cantidad}."
            )
        self.cantidad_en_transito -= cantidad
        self.cantidad_disponible += cantidad

    def registrar_merma_transito(self, cantidad: int) -> None:
        """Descuenta unidades de tránsito como pérdida cuando un bulto es rechazado."""
        if cantidad <= 0:
            raise Datos_Invalidos_Exception("La cantidad de merma debe ser mayor a cero.")
        if self.cantidad_en_transito < cantidad:
            raise Stock_Insuficiente_Exception(
                f"Tránsito insuficiente: en tránsito={self.cantidad_en_transito}, merma={cantidad}."
            )
        self.cantidad_en_transito -= cantidad

    def esta_en_o_bajo_minimo(self) -> bool:
        """Indica si el stock disponible perforó o igualó el nivel mínimo de existencia."""
        return self.cantidad_disponible <= self.nivel_minimo_existencia

    def calcular_reposicion_sugerida(self) -> int:
        """Fórmula de reposición: (nivel_minimo_existencia * 2) - cantidad_disponible."""
        return max(0, (self.nivel_minimo_existencia * 2) - self.cantidad_disponible)
