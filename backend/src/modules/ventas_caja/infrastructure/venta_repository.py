from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.ventas_caja.domain import Comprobante, Detalle_Venta, Resultado_Pago, Venta
from modules.ventas_caja.infrastructure.models import (
    Comprobante_Model,
    Detalle_Venta_Model,
    Numerador_Comprobante_Model,
    Venta_Model,
)


class Venta_Repository:
    """Repositorio ORM de ventas confirmadas con sus líneas y su comprobante."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, venta: Venta) -> Venta:
        """Inserta una venta confirmada y le asigna el id generado."""
        modelo = self._a_modelo(venta)
        session = self._get_session()
        session.add(modelo)
        session.flush()
        venta.id = modelo.id
        return venta

    def obtener_por_id(self, venta_id: int) -> Venta | None:
        modelo = self._get_session().get(Venta_Model, venta_id)
        return self._a_dominio(modelo) if modelo is not None else None

    def listar(
        self,
        local_id: int | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
    ) -> list[Venta]:
        """Lista ventas filtrando opcionalmente por local y rango de fechas (inclusive)."""
        stmt = select(Venta_Model).order_by(Venta_Model.fecha_hora, Venta_Model.id)
        if local_id is not None:
            stmt = stmt.where(Venta_Model.local_id == local_id)
        if desde is not None:
            stmt = stmt.where(Venta_Model.fecha_hora >= desde)
        if hasta is not None:
            stmt = stmt.where(Venta_Model.fecha_hora <= hasta)
        modelos = self._get_session().scalars(stmt).unique().all()
        return [self._a_dominio(m) for m in modelos]

    def siguiente_numero_comprobante(self, local_id: int) -> int:
        """Reserva el próximo número correlativo del local dentro de la transacción actual.

        El INSERT/UPDATE toma el lock de escritura antes de leer, así otra petición
        concurrente espera al commit (o rollback) de esta y obtiene el número siguiente.
        """
        session = self._get_session()
        session.execute(
            sqlite_insert(Numerador_Comprobante_Model)
            .values(local_id=local_id, ultimo_numero=0)
            .on_conflict_do_nothing(index_elements=["local_id"])
        )
        session.execute(
            update(Numerador_Comprobante_Model)
            .where(Numerador_Comprobante_Model.local_id == local_id)
            .values(ultimo_numero=Numerador_Comprobante_Model.ultimo_numero + 1)
        )
        stmt = select(Numerador_Comprobante_Model.ultimo_numero).where(
            Numerador_Comprobante_Model.local_id == local_id
        )
        return session.scalar(stmt)

    def obtener_para_devolucion(self, venta_id: int) -> Venta | None:
        """Busca la venta tomando el lock de escritura (equivalente a SELECT ... FOR UPDATE).

        Así dos devoluciones concurrentes de la misma venta se serializan y la segunda
        ve lo que ya devolvió la primera al validar el acumulado (V5).
        """
        session = self._get_session()
        bloqueo = update(Venta_Model).where(Venta_Model.id == venta_id).values(id=Venta_Model.id)
        if session.execute(bloqueo).rowcount == 0:
            return None
        return self.obtener_por_id(venta_id)

    def total_cobrado(self, local_id: int, desde: datetime, hasta: datetime) -> tuple[int, Decimal]:
        """Cantidad de ventas y suma cobrada del local en el período (inclusive)."""
        stmt = (
            select(func.count(Venta_Model.id), func.coalesce(func.sum(Comprobante_Model.total_cobrado), 0))
            .join(Comprobante_Model, Comprobante_Model.venta_id == Venta_Model.id)
            .where(
                Venta_Model.local_id == local_id,
                Venta_Model.fecha_hora >= desde,
                Venta_Model.fecha_hora <= hasta,
            )
        )
        cantidad, total = self._get_session().execute(stmt).one()
        return cantidad, Decimal(str(total)).quantize(Decimal("0.01"))

    @staticmethod
    def _a_modelo(venta: Venta) -> Venta_Model:
        """Venta, líneas y comprobante como modelos ORM; falla si la venta no se confirmó."""
        comprobante = venta.comprobante_emitido
        return Venta_Model(
            local_id=venta.local_id,
            fecha_hora=venta.fecha_hora,
            total=venta.total,
            detalles=[
                Detalle_Venta_Model(
                    producto_id=d.producto_id,
                    cantidad=d.cantidad,
                    precio_unitario=d.precio_unitario,
                )
                for d in venta.detalles
            ],
            comprobante=Comprobante_Model(
                local_id=comprobante.local_id,
                numero=comprobante.numero,
                fecha_emision=comprobante.fecha_emision,
                total=comprobante.total,
                medio_pago=comprobante.pago.medio_pago,
                total_cobrado=comprobante.pago.monto_cobrado,
                recargo=comprobante.pago.recargo,
                vuelto=comprobante.pago.vuelto,
                detalle_pago=comprobante.pago.detalle,
            ),
        )

    @staticmethod
    def _a_dominio(modelo: Venta_Model) -> Venta:
        c = modelo.comprobante
        comprobante = Comprobante(
            numero=c.numero,
            local_id=c.local_id,
            fecha_emision=c.fecha_emision,
            total=c.total,
            pago=Resultado_Pago(
                medio_pago=c.medio_pago,
                monto_cobrado=c.total_cobrado,
                recargo=c.recargo,
                vuelto=c.vuelto,
                detalle=c.detalle_pago,
            ),
        )
        detalles = [Detalle_Venta(d.producto_id, d.cantidad, d.precio_unitario) for d in modelo.detalles]
        return Venta.reconstruir(modelo.id, modelo.local_id, modelo.fecha_hora, detalles, comprobante)
