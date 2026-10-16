from sqlalchemy import Boolean, CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from config.database.base import Base
from modules.ubicaciones_stock.domain.exceptions import Datos_Invalidos_Exception


class Ubicacion(Base):
    """Clase base ORM para nodos de la red física (Centro de Distribución y Locales)."""

    __tablename__ = "ubicaciones"
    __table_args__ = (
        CheckConstraint("tipo IN ('CD', 'LOCAL')", name="ck_ubicaciones_tipo"),
        CheckConstraint("activo IN (0, 1)", name="ck_ubicaciones_activo"),
        {"extend_existing": True},
    )
    __mapper_args__ = {
        "polymorphic_on": "tipo",
    }

    id: Mapped[int | None] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tipo: Mapped[str] = mapped_column(String, nullable=False)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    direccion: Mapped[str] = mapped_column(String, nullable=False)
    telefono: Mapped[str | None] = mapped_column(String, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __init__(
        self,
        tipo: str,
        nombre: str,
        direccion: str,
        telefono: str | None = None,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        if not nombre or not nombre.strip():
            raise Datos_Invalidos_Exception("El nombre de la ubicación no puede estar vacío.")
        if not direccion or not direccion.strip():
            raise Datos_Invalidos_Exception("La dirección de la ubicación no puede estar vacía.")
        if tipo not in ("CD", "LOCAL"):
            raise Datos_Invalidos_Exception(f"Tipo de ubicación inválido: {tipo}. Debe ser 'CD' o 'LOCAL'.")

        if id is not None:
            self.id = id
        self.tipo = tipo
        self.nombre = nombre.strip()
        self.direccion = direccion.strip()
        self.telefono = telefono.strip() if telefono else None
        self.activo = bool(activo)

    @validates("nombre")
    def _validar_nombre(self, key: str, value: str) -> str:
        if not value or not value.strip():
            raise Datos_Invalidos_Exception("El nombre de la ubicación no puede estar vacío.")
        return value.strip()

    @validates("direccion")
    def _validar_direccion(self, key: str, value: str) -> str:
        if not value or not value.strip():
            raise Datos_Invalidos_Exception("La dirección de la ubicación no puede estar vacía.")
        return value.strip()

    def desactivar(self) -> None:
        """Baja lógica de la ubicación."""
        self.activo = False

    def activar(self) -> None:
        """Reactiva la ubicación."""
        self.activo = True

    def es_centro_distribucion(self) -> bool:
        return self.tipo == "CD"


class Centro_Distribucion(Ubicacion):
    """Nodo central único que recibe compras a proveedores y abastece a los locales."""

    __mapper_args__ = {
        "polymorphic_identity": "CD",
    }

    def __init__(
        self,
        nombre: str,
        direccion: str,
        telefono: str | None = None,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        super().__init__(
            tipo="CD",
            nombre=nombre,
            direccion=direccion,
            telefono=telefono,
            id=id,
            activo=activo,
        )


class Local(Ubicacion):
    """Sucursal minorista que atiende ventas al público y solicita reposición al CD."""

    __mapper_args__ = {
        "polymorphic_identity": "LOCAL",
    }

    def __init__(
        self,
        nombre: str,
        direccion: str,
        telefono: str,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        if not telefono or not telefono.strip():
            raise Datos_Invalidos_Exception("El local debe poseer un número de teléfono de contacto.")
        super().__init__(
            tipo="LOCAL",
            nombre=nombre,
            direccion=direccion,
            telefono=telefono,
            id=id,
            activo=activo,
        )
