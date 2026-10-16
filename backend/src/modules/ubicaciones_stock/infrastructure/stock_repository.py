from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from config.database.request_session_context import Request_Session_Context
from errors.persistence_error import Persistencia_Exception
from modules.ubicaciones_stock.domain.alerta_stock import Alerta_Stock
from modules.ubicaciones_stock.domain.exceptions import Entidad_Duplicada_Exception
from modules.ubicaciones_stock.domain.stock import Stock
from modules.ubicaciones_stock.domain.ubicacion import Ubicacion


class Stock_Repository:
    """Acceso ORM a inventario usando la sesión activa de la petición."""

    @staticmethod
    def _sesion():
        return Request_Session_Context.obtener_sesion()

    def crear(self, stock: Stock) -> Stock:
        sesion = self._sesion()
        if self.buscar_por_producto_y_ubicacion(stock.producto_id, stock.ubicacion_id):
            raise Entidad_Duplicada_Exception("Ya existe un registro de stock para ese producto y ubicación.")
        try:
            sesion.add(stock)
            sesion.flush()
            return stock
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception("Ya existe un registro de stock para ese producto y ubicación.") from error
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al crear stock: {error}") from error

    def actualizar(self, stock: Stock) -> None:
        try:
            self._sesion().flush()
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al actualizar stock: {error}") from error

    def buscar_por_id(self, stock_id: int) -> Stock | None:
        return self._sesion().get(Stock, stock_id)

    def buscar_por_producto_y_ubicacion(self, producto_id: int, ubicacion_id: int) -> Stock | None:
        stmt = select(Stock).where(Stock.producto_id == producto_id, Stock.ubicacion_id == ubicacion_id)
        return self._sesion().scalars(stmt).first()

    def listar_por_ubicacion(self, ubicacion_id: int) -> list[Stock]:
        stmt = select(Stock).where(Stock.ubicacion_id == ubicacion_id).order_by(Stock.producto_id)
        return list(self._sesion().scalars(stmt).all())

    def listar_por_producto(self, producto_id: int) -> list[Stock]:
        stmt = select(Stock).where(Stock.producto_id == producto_id).order_by(Stock.ubicacion_id)
        return list(self._sesion().scalars(stmt).all())

    def inicializar_stock_para_producto(self, producto_id: int, nivel_minimo: int) -> None:
        sesion = self._sesion()
        ubicaciones = sesion.scalars(select(Ubicacion).where(Ubicacion.activo.is_(True))).all()
        existentes = {stock.ubicacion_id for stock in self.listar_por_producto(producto_id)}
        try:
            for ubicacion in ubicaciones:
                if ubicacion.id not in existentes:
                    sesion.add(Stock(producto_id=producto_id, ubicacion_id=ubicacion.id, nivel_minimo_existencia=nivel_minimo))
                    sesion.flush()
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al inicializar stock: {error}") from error

    def registrar_alerta(self, alerta: Alerta_Stock) -> Alerta_Stock:
        try:
            sesion = self._sesion()
            sesion.add(alerta)
            sesion.flush()
            return alerta
        except SQLAlchemyError as error:
            raise Persistencia_Exception(f"Error al registrar alerta de stock: {error}") from error

    def listar_alertas(self, solo_no_leidas: bool = False, ubicacion_id: int | None = None) -> list[Alerta_Stock]:
        stmt = select(Alerta_Stock)
        if solo_no_leidas:
            stmt = stmt.where(Alerta_Stock.leida.is_(False))
        if ubicacion_id is not None:
            stmt = stmt.where(Alerta_Stock.ubicacion_id == ubicacion_id)
        return list(self._sesion().scalars(stmt.order_by(Alerta_Stock.id.desc())).all())
