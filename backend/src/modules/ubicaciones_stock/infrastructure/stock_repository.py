from sqlalchemy import ColumnElement, Select, select, update
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.ubicaciones_stock.domain import Stock
from modules.ubicaciones_stock.infrastructure.models import Stock_Model, Ubicacion_Model


class Stock_Repository:
    """Repositorio ORM de stock por producto y ubicación."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def obtener(self, producto_id: int, ubicacion_id: int) -> Stock | None:
        fila = self._get_session().execute(self._consulta().where(*self._clave(producto_id, ubicacion_id))).first()
        return self._a_dominio(*fila) if fila is not None else None

    def obtener_para_actualizar(self, producto_id: int, ubicacion_id: int) -> Stock | None:
        """Lee el stock tomando antes el lock de escritura de SQLite (equivale a SELECT ... FOR UPDATE).

        Así dos ventas o reservas simultáneas del mismo producto se serializan y la
        segunda ve lo que descontó la primera (V3).
        """
        session = self._get_session()
        bloqueo = (
            update(Stock_Model)
            .where(*self._clave(producto_id, ubicacion_id))
            .values(id=Stock_Model.id)
            .execution_options(synchronize_session=False)
        )
        if session.execute(bloqueo).rowcount == 0:
            return None
        stmt = self._consulta().where(*self._clave(producto_id, ubicacion_id)).execution_options(populate_existing=True)
        return self._a_dominio(*session.execute(stmt).one())

    def guardar(self, stock: Stock) -> Stock:
        modelo = Stock_Model(producto_id=stock.producto_id, ubicacion_id=stock.ubicacion_id)
        self._copiar(stock, modelo)
        session = self._get_session()
        session.add(modelo)
        session.flush()
        stock.id = modelo.id
        return stock

    def actualizar(self, stock: Stock) -> None:
        modelo = self._get_session().get(Stock_Model, stock.id)
        self._copiar(stock, modelo)
        self._get_session().flush()

    def listar(
        self,
        ubicacion_id: int | None = None,
        producto_id: int | None = None,
        solo_bajo_minimo: bool = False,
    ) -> list[Stock]:
        stmt = self._consulta().order_by(Stock_Model.ubicacion_id, Stock_Model.producto_id)
        if ubicacion_id is not None:
            stmt = stmt.where(Stock_Model.ubicacion_id == ubicacion_id)
        if producto_id is not None:
            stmt = stmt.where(Stock_Model.producto_id == producto_id)
        if solo_bajo_minimo:
            stmt = stmt.where(Stock_Model.cantidad_disponible <= Stock_Model.nivel_minimo_existencia)
        return [self._a_dominio(*fila) for fila in self._get_session().execute(stmt)]

    @staticmethod
    def _consulta() -> Select:
        return select(Stock_Model, Ubicacion_Model.tipo).join(
            Ubicacion_Model, Ubicacion_Model.id == Stock_Model.ubicacion_id
        )

    @staticmethod
    def _clave(producto_id: int, ubicacion_id: int) -> tuple[ColumnElement[bool], ColumnElement[bool]]:
        return (Stock_Model.producto_id == producto_id, Stock_Model.ubicacion_id == ubicacion_id)

    @staticmethod
    def _copiar(stock: Stock, modelo: Stock_Model) -> None:
        modelo.cantidad_disponible = stock.cantidad_disponible
        modelo.cantidad_en_transito = stock.cantidad_en_transito
        modelo.nivel_minimo_existencia = stock.nivel_minimo_existencia

    @staticmethod
    def _a_dominio(modelo: Stock_Model, tipo_ubicacion: str) -> Stock:
        return Stock(
            producto_id=modelo.producto_id,
            ubicacion_id=modelo.ubicacion_id,
            nivel_minimo_existencia=modelo.nivel_minimo_existencia,
            cantidad_disponible=modelo.cantidad_disponible,
            cantidad_en_transito=modelo.cantidad_en_transito,
            es_local=tipo_ubicacion == "LOCAL",
            id=modelo.id,
        )
