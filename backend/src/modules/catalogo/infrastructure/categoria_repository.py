from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from config.database.request_session_context import Request_Session_Context
from errors.persistence_error import Persistencia_Exception
from modules.catalogo.domain.categoria import Categoria
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception


class Categoria_Repository:
    """Acceso ORM a categorías usando la sesión activa de la petición."""

    def crear(self, categoria: Categoria) -> Categoria:
        try:
            sesion = Request_Session_Context.obtener_sesion()
            with sesion.begin_nested():
                sesion.add(categoria)
                sesion.flush()
            return categoria
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(
                f"Ya existe una categoría con el nombre '{categoria.nombre}'."
            ) from error
        except Exception as error:
            raise Persistencia_Exception(f"Error al crear categoría: {error}") from error

    def buscar_por_id(self, categoria_id: int) -> Categoria | None:
        try:
            return Request_Session_Context.obtener_sesion().get(Categoria, categoria_id)
        except Exception as error:
            raise Persistencia_Exception(f"Error al buscar categoría por ID: {error}") from error

    def buscar_por_nombre(self, nombre: str) -> Categoria | None:
        try:
            sentencia = select(Categoria).where(Categoria.nombre == nombre.strip())
            return Request_Session_Context.obtener_sesion().scalar(sentencia)
        except Exception as error:
            raise Persistencia_Exception(f"Error al buscar categoría por nombre: {error}") from error

    def listar(self) -> list[Categoria]:
        try:
            sentencia = select(Categoria).order_by(Categoria.nombre.asc())
            return list(Request_Session_Context.obtener_sesion().scalars(sentencia))
        except Exception as error:
            raise Persistencia_Exception(f"Error al listar categorías: {error}") from error
