from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.ubicaciones_stock.domain import Alerta_Stock
from modules.ubicaciones_stock.infrastructure.models import Alerta_Stock_Model


class Alerta_Stock_Repository:
    """Repositorio ORM de alertas de stock bajo."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, alerta: Alerta_Stock) -> Alerta_Stock:
        modelo = Alerta_Stock_Model(
            stock_id=alerta.stock_id,
            producto_id=alerta.producto_id,
            ubicacion_id=alerta.ubicacion_id,
            cantidad_disponible=alerta.cantidad_disponible,
            nivel_minimo=alerta.nivel_minimo,
            fecha_emision=alerta.fecha_emision,
            leida=alerta.leida,
        )
        session = self._get_session()
        session.add(modelo)
        session.flush()
        alerta.id = modelo.id
        return alerta

    def actualizar(self, alerta: Alerta_Stock) -> None:
        modelo = self._get_session().get(Alerta_Stock_Model, alerta.id)
        modelo.leida = alerta.leida
        self._get_session().flush()

    def obtener_por_id(self, alerta_id: int) -> Alerta_Stock | None:
        modelo = self._get_session().get(Alerta_Stock_Model, alerta_id)
        return self._a_dominio(modelo) if modelo is not None else None

    def existe_no_leida(self, stock_id: int) -> bool:
        stmt = select(Alerta_Stock_Model.id).where(
            Alerta_Stock_Model.stock_id == stock_id,
            Alerta_Stock_Model.leida.is_(False),
        )
        return self._get_session().scalar(stmt) is not None

    def listar(self, leida: bool | None = None, ubicacion_id: int | None = None) -> list[Alerta_Stock]:
        stmt = select(Alerta_Stock_Model).order_by(Alerta_Stock_Model.fecha_emision.desc(), Alerta_Stock_Model.id.desc())
        if leida is not None:
            stmt = stmt.where(Alerta_Stock_Model.leida.is_(leida))
        if ubicacion_id is not None:
            stmt = stmt.where(Alerta_Stock_Model.ubicacion_id == ubicacion_id)
        return [self._a_dominio(m) for m in self._get_session().scalars(stmt)]

    @staticmethod
    def _a_dominio(modelo: Alerta_Stock_Model) -> Alerta_Stock:
        return Alerta_Stock(
            stock_id=modelo.stock_id,
            producto_id=modelo.producto_id,
            ubicacion_id=modelo.ubicacion_id,
            cantidad_disponible=modelo.cantidad_disponible,
            nivel_minimo=modelo.nivel_minimo,
            fecha_emision=modelo.fecha_emision,
            leida=modelo.leida,
            id=modelo.id,
        )
