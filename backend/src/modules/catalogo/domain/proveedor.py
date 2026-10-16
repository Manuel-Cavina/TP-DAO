from typing import TYPE_CHECKING

from config.database.base import Base
from sqlalchemy import Boolean, CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception

if TYPE_CHECKING:
    from modules.catalogo.domain.producto import Producto


class Proveedor(Base):
    """Entidad de dominio que representa a un proveedor externo."""

    __tablename__ = "proveedores"
    __table_args__ = (
        CheckConstraint("length(cuit) = 11 AND cuit GLOB '[0-9]*'", name="chk_proveedor_cuit"),
        CheckConstraint("activo IN (0, 1)", name="chk_proveedor_activo"),
    )

    id: Mapped[int | None] = mapped_column(Integer, primary_key=True, autoincrement=True, default=None)
    cuit: Mapped[str] = mapped_column(String(11), unique=True, nullable=False)
    razon_social: Mapped[str] = mapped_column(String, nullable=False)
    telefono: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    productos: Mapped[list["Producto"]] = relationship("Producto", back_populates="proveedor")

    def __init__(
        self,
        cuit: str,
        razon_social: str,
        telefono: str,
        email: str,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        self._validar_cuit(cuit)
        if not razon_social or not razon_social.strip():
            raise Datos_Invalidos_Exception("La razón social no puede estar vacía.")

        self.id = id
        self.cuit = cuit.strip()
        self.razon_social = razon_social.strip()
        self.telefono = telefono.strip()
        self.email = email.strip()
        self.activo = activo

    @staticmethod
    def _validar_cuit(cuit: str) -> None:
        if not cuit or len(cuit.strip()) != 11 or not cuit.strip().isdigit():
            raise Datos_Invalidos_Exception("El CUIT debe contener exactamente 11 dígitos numéricos.")

    @validates("cuit")
    def _validar_cuit_attr(self, key: str, value: str) -> str:
        self._validar_cuit(value)
        return value.strip()

    @validates("razon_social")
    def _validar_razon_social(self, key: str, value: str) -> str:
        if not value or not value.strip():
            raise Datos_Invalidos_Exception("La razón social no puede estar vacía.")
        return value.strip()

    @validates("telefono")
    def _validar_telefono(self, key: str, value: str) -> str:
        return value.strip() if value else ""

    @validates("email")
    def _validar_email(self, key: str, value: str) -> str:
        return value.strip() if value else ""

    def desactivar(self) -> None:
        """Da de baja lógica al proveedor."""
        self.activo = False

    def activar(self) -> None:
        """Reactiva al proveedor."""
        self.activo = True
