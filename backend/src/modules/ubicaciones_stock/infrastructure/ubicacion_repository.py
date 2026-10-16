from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from config.database.request_session_context import Request_Session_Context
from errors.persistence_error import Persistencia_Exception
from modules.ubicaciones_stock.domain.exceptions import Entidad_Duplicada_Exception
from modules.ubicaciones_stock.domain.stock import Stock
from modules.ubicaciones_stock.domain.ubicacion import Centro_Distribucion, Ubicacion


class Ubicacion_Repository:
    """Acceso ORM a ubicaciones usando la sesión activa de la petición."""

    @staticmethod
    def _sesion():
        return Request_Session_Context.obtener_sesion()

    def crear(self, ubicacion: Ubicacion) -> Ubicacion:
        sesion = self._sesion()
        if ubicacion.es_centro_distribucion() and self.obtener_centro_distribucion() is not None:
            raise Entidad_Duplicada_Exception("Ya existe un Centro de Distribución registrado en el sistema.")
        try:
            sesion.add(ubicacion)
            sesion.flush()
            return ubicacion
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception("Ya existe la ubicación especificada.") from error
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al crear ubicación: {error}") from error

    def actualizar(self, ubicacion: Ubicacion) -> None:
        try:
            self._sesion().flush()
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al actualizar ubicación: {error}") from error

    def buscar_por_id(self, ubicacion_id: int) -> Ubicacion | None:
        try:
            return self._sesion().get(Ubicacion, ubicacion_id)
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al buscar ubicación por ID: {error}") from error

    def obtener_centro_distribucion(self) -> Centro_Distribucion | None:
        try:
            stmt = select(Centro_Distribucion).where(Centro_Distribucion.activo.is_(True)).limit(1)
            return self._sesion().scalars(stmt).first()
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al obtener Centro de Distribución: {error}") from error

    def listar(self, solo_activas: bool = True) -> list[Ubicacion]:
        try:
            stmt = select(Ubicacion)
            if solo_activas:
                stmt = stmt.where(Ubicacion.activo.is_(True))
            return list(self._sesion().scalars(stmt.order_by(Ubicacion.tipo, Ubicacion.nombre)).all())
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al listar ubicaciones: {error}") from error

    def tiene_stock_asociado(self, ubicacion_id: int) -> bool:
        try:
            stmt = select(func.count(Stock.id)).where(
                Stock.ubicacion_id == ubicacion_id,
                or_(Stock.cantidad_disponible > 0, Stock.cantidad_en_transito > 0),
            )
            return bool(self._sesion().scalar(stmt))
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al verificar stock de ubicación: {error}") from error
