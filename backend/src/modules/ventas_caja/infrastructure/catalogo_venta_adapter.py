"""Adaptador de Catalogo_Venta_Contract sobre la tabla productos de Integrante 1.

Igual que Stock_Venta_Adapter: consulta liviana sin modelos ORM ajenos, a
reemplazar por el servicio de catálogo cuando exista.
"""

from decimal import Decimal

from sqlalchemy import column, select, table
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.catalogo.domain.exceptions.catalogo_exceptions import Entidad_No_Encontrada_Exception
from modules.ventas_caja.application.catalogo_venta_contract import Catalogo_Venta_Contract
from modules.ventas_caja.domain.estrategia_pago import redondear

_productos = table("productos", column("id"), column("precio_venta"), column("activo"))


class Catalogo_Venta_Adapter(Catalogo_Venta_Contract):
    """Precio de venta vigente de un producto activo."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def obtener_precio_venta(self, producto_id: int) -> Decimal:
        stmt = select(_productos.c.precio_venta, _productos.c.activo).where(_productos.c.id == producto_id)
        fila = self._get_session().execute(stmt).first()
        if fila is None or not fila.activo:
            raise Entidad_No_Encontrada_Exception(f"No existe un producto activo con id {producto_id}.")
        # schema.sql guarda precio_venta como REAL: se pasa por str para no arrastrar error binario.
        return redondear(Decimal(str(fila.precio_venta)))
