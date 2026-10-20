from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.catalogo.domain import Categoria
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception
from modules.catalogo.infrastructure.models import Categoria_Model


class Categoria_Repository:
    """Repositorio ORM de categorías."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, categoria: Categoria) -> Categoria:
        modelo = Categoria_Model(nombre=categoria.nombre, activo=categoria.activo)
        self._get_session().add(modelo)
        self._flush(categoria.nombre)
        categoria.id = modelo.id
        return categoria

    def actualizar(self, categoria: Categoria) -> None:
        modelo = self._get_session().get(Categoria_Model, categoria.id)
        modelo.nombre = categoria.nombre
        modelo.activo = categoria.activo
        self._flush(categoria.nombre)

    def obtener_por_id(self, categoria_id: int) -> Categoria | None:
        modelo = self._get_session().get(Categoria_Model, categoria_id)
        return self._a_dominio(modelo) if modelo is not None else None

    def obtener_por_nombre(self, nombre: str) -> Categoria | None:
        stmt = select(Categoria_Model).where(Categoria_Model.nombre == nombre.strip())
        modelo = self._get_session().scalars(stmt).first()
        return self._a_dominio(modelo) if modelo is not None else None

    def listar(self, solo_activas: bool = False) -> list[Categoria]:
        stmt = select(Categoria_Model).order_by(Categoria_Model.nombre)
        if solo_activas:
            stmt = stmt.where(Categoria_Model.activo.is_(True))
        return [self._a_dominio(m) for m in self._get_session().scalars(stmt)]

    def _flush(self, nombre: str) -> None:
        try:
            self._get_session().flush()
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(f"Ya existe la categoría '{nombre}'.") from error

    @staticmethod
    def _a_dominio(modelo: Categoria_Model) -> Categoria:
        return Categoria(nombre=modelo.nombre, id=modelo.id, activo=modelo.activo)
