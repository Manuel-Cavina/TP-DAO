from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.evento_trazabilidad import Evento_Trazabilidad
from modules.logistica.infrastructure.models import Evento_Trazabilidad_Model


class Trazabilidad_Repository:
    """Repositorio ORM inmutable para eventos de trazabilidad y auditoría logística (V2/US3)."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, evento: Evento_Trazabilidad) -> Evento_Trazabilidad:
        """Inserta un nuevo registro inmutable de evento de trazabilidad."""
        session = self._get_session()
        modelo = Evento_Trazabilidad_Model(
            tipo_entidad=evento.tipo_entidad,
            entidad_id=evento.entidad_id,
            accion=evento.accion,
            estado_anterior=evento.estado_anterior,
            estado_nuevo=evento.estado_nuevo,
            actor=evento.actor,
            origen_id=evento.origen_id,
            destino_id=evento.destino_id,
            registros_asociados=evento.registros_asociados,
            motivo_o_evidencia=evento.motivo_o_evidencia,
            fecha_hora=evento.fecha_hora,
        )
        session.add(modelo)
        session.flush()
        evento.id = modelo.id
        return evento

    def listar_por_entidad(self, tipo_entidad: str, entidad_id: int) -> list[Evento_Trazabilidad]:
        """Obtiene la línea de tiempo cronológica e inmutable de eventos para una entidad."""
        session = self._get_session()
        stmt = (
            select(Evento_Trazabilidad_Model)
            .where(
                Evento_Trazabilidad_Model.tipo_entidad == tipo_entidad.strip().upper(),
                Evento_Trazabilidad_Model.entidad_id == entidad_id,
            )
            .order_by(Evento_Trazabilidad_Model.id.asc())
        )
        modelos = session.scalars(stmt).all()
        return [
            Evento_Trazabilidad(
                id=m.id,
                tipo_entidad=m.tipo_entidad,
                entidad_id=m.entidad_id,
                accion=m.accion,
                estado_anterior=m.estado_anterior,
                estado_nuevo=m.estado_nuevo,
                actor=m.actor,
                origen_id=m.origen_id,
                destino_id=m.destino_id,
                registros_asociados=m.registros_asociados,
                motivo_o_evidencia=m.motivo_o_evidencia,
                fecha_hora=m.fecha_hora,
            )
            for m in modelos
        ]

    def listar_todos(self) -> list[Evento_Trazabilidad]:
        """Devuelve todos los eventos registrados en orden cronológico descendente."""
        session = self._get_session()
        stmt = select(Evento_Trazabilidad_Model).order_by(Evento_Trazabilidad_Model.id.desc())
        modelos = session.scalars(stmt).all()
        return [
            Evento_Trazabilidad(
                id=m.id,
                tipo_entidad=m.tipo_entidad,
                entidad_id=m.entidad_id,
                accion=m.accion,
                estado_anterior=m.estado_anterior,
                estado_nuevo=m.estado_nuevo,
                actor=m.actor,
                origen_id=m.origen_id,
                destino_id=m.destino_id,
                registros_asociados=m.registros_asociados,
                motivo_o_evidencia=m.motivo_o_evidencia,
                fecha_hora=m.fecha_hora,
            )
            for m in modelos
        ]
