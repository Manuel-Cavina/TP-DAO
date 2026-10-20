"""Adaptador de Stock_Service_Contract sobre las tablas de Integrante 1.

Lee y actualiza `ubicaciones`, `productos` y `stocks` (creadas por schema.sql) con
expresiones SQLAlchemy livianas, sin registrar modelos ORM ajenos en Base.metadata.
Cuando ubicaciones_stock publique su Stock_Service, se reemplaza este adaptador en
`get_*_service` del router sin tocar los casos de uso.
"""

from sqlalchemy import Update, column, select, table, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception,
    Stock_Insuficiente_Exception,
)

_ubicaciones = table("ubicaciones", column("id"), column("tipo"), column("activo"))
_productos = table("productos", column("id"), column("activo"))
_stocks = table(
    "stocks",
    column("producto_id"),
    column("ubicacion_id"),
    column("cantidad_disponible"),
    column("cantidad_en_transito"),
)


class Stock_Logistica_Adapter(Stock_Service_Contract):
    """Movimientos de stock del circuito CD -> local: reserva, transito, acreditacion y merma."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def validar_centro_distribucion(self, ubicacion_id: int) -> None:
        self._validar_ubicacion(ubicacion_id, "CD", "Centro de Distribucion")

    def validar_local(self, ubicacion_id: int) -> None:
        self._validar_ubicacion(ubicacion_id, "LOCAL", "local")

    def validar_producto(self, producto_id: int) -> None:
        stmt = select(_productos.c.activo).where(_productos.c.id == producto_id)
        activo = self._get_session().scalar(stmt)
        if not activo:
            raise Producto_No_Encontrado_Exception(f"No existe un producto activo con id {producto_id}.")

    def reservar_para_despacho(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        stmt = (
            update(_stocks)
            .where(
                _stocks.c.producto_id == producto_id,
                _stocks.c.ubicacion_id == cd_id,
                _stocks.c.cantidad_disponible >= cantidad,
            )
            .values(cantidad_disponible=_stocks.c.cantidad_disponible - cantidad)
        )
        if self._get_session().execute(stmt).rowcount == 0:
            raise Stock_Insuficiente_Exception(
                f"Stock insuficiente del producto {producto_id} en el Centro de Distribucion {cd_id}."
            )

    def registrar_en_transito(self, producto_id: int, local_id: int, cantidad: int) -> None:
        # Si el local nunca tuvo el producto se crea su registro de stock en cero disponible.
        stmt = (
            sqlite_insert(_stocks)
            .values(
                producto_id=producto_id,
                ubicacion_id=local_id,
                cantidad_disponible=0,
                cantidad_en_transito=cantidad,
            )
            .on_conflict_do_update(
                index_elements=["producto_id", "ubicacion_id"],
                set_={"cantidad_en_transito": _stocks.c.cantidad_en_transito + cantidad},
            )
        )
        self._get_session().execute(stmt)

    def acreditar_verificado(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stmt = self._descontar_transito(producto_id, local_id, cantidad).values(
            cantidad_en_transito=_stocks.c.cantidad_en_transito - cantidad,
            cantidad_disponible=_stocks.c.cantidad_disponible + cantidad,
        )
        self._ejecutar_movimiento_transito(stmt, producto_id, local_id)

    def registrar_merma(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stmt = self._descontar_transito(producto_id, local_id, cantidad).values(
            cantidad_en_transito=_stocks.c.cantidad_en_transito - cantidad,
        )
        self._ejecutar_movimiento_transito(stmt, producto_id, local_id)

    def _validar_ubicacion(self, ubicacion_id: int, tipo: str, descripcion: str) -> None:
        stmt = select(_ubicaciones.c.tipo, _ubicaciones.c.activo).where(_ubicaciones.c.id == ubicacion_id)
        fila = self._get_session().execute(stmt).first()
        if fila is None or not fila.activo or fila.tipo != tipo:
            raise Entidad_No_Encontrada_Exception(
                f"No existe un {descripcion} activo con id {ubicacion_id}."
            )

    @staticmethod
    def _descontar_transito(producto_id: int, local_id: int, cantidad: int) -> Update:
        return update(_stocks).where(
            _stocks.c.producto_id == producto_id,
            _stocks.c.ubicacion_id == local_id,
            _stocks.c.cantidad_en_transito >= cantidad,
        )

    def _ejecutar_movimiento_transito(self, stmt: Update, producto_id: int, local_id: int) -> None:
        if self._get_session().execute(stmt).rowcount == 0:
            raise Stock_Insuficiente_Exception(
                f"El local {local_id} no tiene en transito las unidades del producto {producto_id}."
            )
