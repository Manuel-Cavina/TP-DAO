from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from config.database.request_session_context import Request_Session_Context
from errors.persistence_error import Persistencia_Exception
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception
from modules.catalogo.domain.producto import Producto


class Producto_Repository:
    """Acceso ORM a productos usando la sesión activa de la petición."""

    def crear(self, producto: Producto) -> Producto:
        try:
            sesion = Request_Session_Context.obtener_sesion()
            with sesion.begin_nested():
                sesion.add(producto)
                sesion.flush()
            return producto
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(
                f"El producto con código '{producto.codigo}' ya se encuentra registrado."
            ) from error
        except Exception as error:
            raise Persistencia_Exception(f"Error de base de datos al crear producto: {error}") from error

    def actualizar(self, producto: Producto) -> None:
        try:
            Request_Session_Context.obtener_sesion().flush()
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(
                f"El producto con código '{producto.codigo}' ya se encuentra registrado."
            ) from error
        except Exception as error:
            raise Persistencia_Exception(f"Error al actualizar producto: {error}") from error

    def buscar_por_codigo(self, codigo: str) -> Producto | None:
        try:
            sentencia = select(Producto).where(Producto.codigo == codigo.strip())
            return Request_Session_Context.obtener_sesion().scalar(sentencia)
        except Exception as error:
            raise Persistencia_Exception(f"Error al buscar producto por código: {error}") from error

    def buscar_por_id(self, producto_id: int) -> Producto | None:
        try:
            return Request_Session_Context.obtener_sesion().get(Producto, producto_id)
        except Exception as error:
            raise Persistencia_Exception(f"Error al buscar producto por ID: {error}") from error

    def listar(self, solo_activos: bool = True, categoria_id: int | None = None) -> list[Producto]:
        try:
            sentencia = select(Producto)
            if solo_activos:
                sentencia = sentencia.where(Producto.activo.is_(True))
            if categoria_id is not None:
                sentencia = sentencia.where(Producto.categoria_id == categoria_id)
            sentencia = sentencia.order_by(Producto.nombre.asc())
            return list(Request_Session_Context.obtener_sesion().scalars(sentencia))
        except Exception as error:
            raise Persistencia_Exception(f"Error al listar productos: {error}") from error
