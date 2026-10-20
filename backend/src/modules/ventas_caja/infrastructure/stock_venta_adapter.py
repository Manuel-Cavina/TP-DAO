"""Adaptador de Stock_Venta_Contract sobre las tablas de Integrante 1.

Lee y actualiza `ubicaciones` y `stocks` (creadas por schema.sql) con expresiones
SQLAlchemy livianas, sin registrar modelos ORM ajenos en Base.metadata. Cuando
ubicaciones_stock publique su Stock_Service, se reemplaza este adaptador en
`get_*_service` del router sin tocar los casos de uso.
"""

from sqlalchemy import column, select, table, update
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception,
    Stock_Insuficiente_Exception,
)
from modules.ventas_caja.application.stock_venta_contract import Stock_Venta_Contract

_ubicaciones = table("ubicaciones", column("id"), column("tipo"), column("activo"))
_stocks = table(
    "stocks",
    column("producto_id"),
    column("ubicacion_id"),
    column("cantidad_disponible"),
)


class Stock_Venta_Adapter(Stock_Venta_Contract):
    """Stock disponible y verificado por producto y local, leído de la tabla stocks."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def validar_local(self, local_id: int) -> None:
        stmt = select(_ubicaciones.c.tipo, _ubicaciones.c.activo).where(_ubicaciones.c.id == local_id)
        fila = self._get_session().execute(stmt).first()
        if fila is None or not fila.activo or fila.tipo != "LOCAL":
            raise Entidad_No_Encontrada_Exception(f"No existe un local activo con id {local_id}.")

    def consultar_disponible(self, producto_id: int, local_id: int) -> int:
        stmt = select(_stocks.c.cantidad_disponible).where(
            _stocks.c.producto_id == producto_id,
            _stocks.c.ubicacion_id == local_id,
        )
        disponible = self._get_session().scalar(stmt)
        return int(disponible) if disponible is not None else 0

    def descontar_por_venta(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stmt = (
            update(_stocks)
            .where(
                _stocks.c.producto_id == producto_id,
                _stocks.c.ubicacion_id == local_id,
                _stocks.c.cantidad_disponible >= cantidad,
            )
            .values(cantidad_disponible=_stocks.c.cantidad_disponible - cantidad)
        )
        if self._get_session().execute(stmt).rowcount == 0:
            raise Stock_Insuficiente_Exception(
                f"Stock insuficiente del producto {producto_id} en el local {local_id}."
            )

    def reingresar_por_devolucion(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stmt = (
            update(_stocks)
            .where(_stocks.c.producto_id == producto_id, _stocks.c.ubicacion_id == local_id)
            .values(cantidad_disponible=_stocks.c.cantidad_disponible + cantidad)
        )
        if self._get_session().execute(stmt).rowcount == 0:
            raise Entidad_No_Encontrada_Exception(
                f"No existe stock del producto {producto_id} en el local {local_id}."
            )
