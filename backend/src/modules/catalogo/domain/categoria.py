from typing import TYPE_CHECKING

from config.database.base import Base
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception

if TYPE_CHECKING:
    from modules.catalogo.domain.producto import Producto


class Categoria(Base):
    """Entidad de dominio que clasifica los productos."""

    __tablename__ = "categorias"

    id: Mapped[int | None] = mapped_column(Integer, primary_key=True, autoincrement=True, default=None)
    nombre: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    productos: Mapped[list["Producto"]] = relationship("Producto", back_populates="categoria")

    def __init__(self, nombre: str, id: int | None = None) -> None:
        if not nombre or not nombre.strip():
            raise Datos_Invalidos_Exception("El nombre de la categoría no puede estar vacío.")
        self.id = id
        self.nombre = nombre.strip()

    @validates("nombre")
    def _validar_nombre(self, key: str, value: str) -> str:
        if not value or not value.strip():
            raise Datos_Invalidos_Exception("El nombre de la categoría no puede estar vacío.")
        return value.strip()
