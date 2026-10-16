from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from config.database.request_session_context import Request_Session_Context
from errors.persistence_error import Persistencia_Exception
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception
from modules.catalogo.domain.proveedor import Proveedor


class Proveedor_Repository:
    """Acceso ORM a proveedores usando la sesión activa de la petición."""

    def crear(self, proveedor: Proveedor) -> Proveedor:
        try:
            sesion = Request_Session_Context.obtener_sesion()
            with sesion.begin_nested():
                sesion.add(proveedor)
                sesion.flush()
            return proveedor
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(
                f"El proveedor con CUIT {proveedor.cuit} ya se encuentra registrado."
            ) from error
        except Exception as error:
            raise Persistencia_Exception(f"Error de base de datos al crear proveedor: {error}") from error

    def actualizar(self, proveedor: Proveedor) -> None:
        try:
            Request_Session_Context.obtener_sesion().flush()
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(
                f"El proveedor con CUIT {proveedor.cuit} ya se encuentra registrado."
            ) from error
        except Exception as error:
            raise Persistencia_Exception(f"Error al actualizar proveedor: {error}") from error

    def buscar_por_cuit(self, cuit: str) -> Proveedor | None:
        try:
            sentencia = select(Proveedor).where(Proveedor.cuit == cuit.strip())
            return Request_Session_Context.obtener_sesion().scalar(sentencia)
        except Exception as error:
            raise Persistencia_Exception(f"Error al buscar proveedor por CUIT: {error}") from error

    def buscar_por_id(self, proveedor_id: int) -> Proveedor | None:
        try:
            return Request_Session_Context.obtener_sesion().get(Proveedor, proveedor_id)
        except Exception as error:
            raise Persistencia_Exception(f"Error al buscar proveedor por ID: {error}") from error

    def listar(self, solo_activos: bool = True) -> list[Proveedor]:
        try:
            sentencia = select(Proveedor)
            if solo_activos:
                sentencia = sentencia.where(Proveedor.activo.is_(True))
            sentencia = sentencia.order_by(Proveedor.razon_social.asc())
            return list(Request_Session_Context.obtener_sesion().scalars(sentencia))
        except Exception as error:
            raise Persistencia_Exception(f"Error al listar proveedores: {error}") from error
