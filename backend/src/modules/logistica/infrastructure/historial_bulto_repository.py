from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.infrastructure.models import Historial_Bulto_Model


class Historial_Bulto_Repository:
    """Repositorio ORM inmutable para auditoria y trazabilidad historica de bultos."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, historial: Historial_Bulto) -> None:
        """Inserta un nuevo registro inmutable en la trazabilidad."""
        session = self._get_session()
        modelo = Historial_Bulto_Model(
            bulto_id=historial.bulto_id,
            estado_anterior=historial.estado_anterior,
            estado_nuevo=historial.estado_nuevo,
            fecha_hora=historial.fecha_hora,
            observacion=historial.observacion,
        )
        session.add(modelo)
        session.flush()

    def listar_por_bulto(self, bulto_id: int) -> list[Historial_Bulto]:
        """Recupera la secuencia historica ordenada de estados de un bulto."""
        session = self._get_session()
        stmt = (
            select(Historial_Bulto_Model)
            .where(Historial_Bulto_Model.bulto_id == bulto_id)
            .order_by(Historial_Bulto_Model.id.asc())
        )
        filas = session.scalars(stmt).all()
        return [
            Historial_Bulto(
                bulto_id=m.bulto_id,
                estado_anterior=m.estado_anterior,
                estado_nuevo=m.estado_nuevo,
                fecha_hora=m.fecha_hora,
                observacion=m.observacion,
            )
            for m in filas
        ]
