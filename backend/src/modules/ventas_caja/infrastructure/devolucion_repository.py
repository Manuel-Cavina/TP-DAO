from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.ventas_caja.domain import Detalle_Devolucion, Devolucion, Venta
from modules.ventas_caja.infrastructure.models import (
    Detalle_Devolucion_Model,
    Detalle_Venta_Model,
    Devolucion_Model,
)


class Devolucion_Repository:
    """Repositorio ORM de devoluciones; cada línea apunta a la línea original de la venta."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, devolucion: Devolucion) -> Devolucion:
        """Inserta la devolución y le asigna el id generado."""
        session = self._get_session()
        lineas_venta = self._lineas_de_venta(devolucion.venta.id)
        modelo = Devolucion_Model(
            venta_id=devolucion.venta.id,
            local_id=devolucion.local_id,
            fecha_hora=devolucion.fecha_hora,
            motivo=devolucion.motivo,
            medio_pago=devolucion.medio_pago,
            monto_reintegrado=devolucion.monto_reintegrado,
            detalles=[
                Detalle_Devolucion_Model(
                    detalle_venta_id=lineas_venta[d.producto_id],
                    producto_id=d.producto_id,
                    cantidad=d.cantidad,
                    precio_unitario=d.precio_unitario,
                )
                for d in devolucion.detalles
            ],
        )
        session.add(modelo)
        session.flush()
        devolucion.id = modelo.id
        return devolucion

    def listar_por_venta(self, venta: Venta) -> list[Devolucion]:
        stmt = (
            select(Devolucion_Model)
            .where(Devolucion_Model.venta_id == venta.id)
            .order_by(Devolucion_Model.fecha_hora, Devolucion_Model.id)
        )
        modelos = self._get_session().scalars(stmt).all()
        return [
            Devolucion.reconstruir(
                id=m.id,
                venta=venta,
                fecha_hora=m.fecha_hora,
                motivo=m.motivo,
                detalles=[
                    Detalle_Devolucion(d.producto_id, d.cantidad, d.precio_unitario) for d in m.detalles
                ],
            )
            for m in modelos
        ]

    def total_reintegrado(self, local_id: int, desde: datetime, hasta: datetime) -> tuple[int, Decimal]:
        """Cantidad de devoluciones y suma reintegrada del local en el período (inclusive)."""
        stmt = select(
            func.count(Devolucion_Model.id),
            func.coalesce(func.sum(Devolucion_Model.monto_reintegrado), 0),
        ).where(
            Devolucion_Model.local_id == local_id,
            Devolucion_Model.fecha_hora >= desde,
            Devolucion_Model.fecha_hora <= hasta,
        )
        cantidad, total = self._get_session().execute(stmt).one()
        return cantidad, Decimal(str(total)).quantize(Decimal("0.01"))

    def _lineas_de_venta(self, venta_id: int | None) -> dict[int, int]:
        stmt = select(Detalle_Venta_Model.producto_id, Detalle_Venta_Model.id).where(
            Detalle_Venta_Model.venta_id == venta_id
        )
        return {producto_id: linea_id for producto_id, linea_id in self._get_session().execute(stmt)}
