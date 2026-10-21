from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.aprobacion_bulto import Aprobacion_Bulto
from modules.logistica.infrastructure.models import Aprobacion_Bulto_Model, Bulto_Model


class Aprobacion_Bulto_Repository:
    """Repositorio ORM para persistencia y consulta inmutable de aprobaciones de bultos."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, aprobacion: Aprobacion_Bulto) -> Aprobacion_Bulto:
        """Persiste una evidencia inmutable de aprobación."""
        session = self._get_session()
        modelo = Aprobacion_Bulto_Model(
            bulto_id=aprobacion.bulto_id,
            actor=aprobacion.actor,
            fecha_hora=aprobacion.fecha_hora,
            observacion=aprobacion.observacion,
        )
        bulto_model = session.get(Bulto_Model, aprobacion.bulto_id)
        if bulto_model is not None:
            modelo.bulto = bulto_model
            bulto_model.aprobacion = modelo

        session.add(modelo)
        session.flush()
        aprobacion.id = modelo.id
        return aprobacion

    def obtener_por_bulto_id(self, bulto_id: int) -> Aprobacion_Bulto | None:
        """Recupera la aprobación de un bulto si existe."""
        session = self._get_session()
        stmt = select(Aprobacion_Bulto_Model).where(Aprobacion_Bulto_Model.bulto_id == bulto_id)
        modelo = session.scalars(stmt).first()
        if modelo is None:
            return None
        return Aprobacion_Bulto(
            id=modelo.id,
            bulto_id=modelo.bulto_id,
            actor=modelo.actor,
            fecha_hora=modelo.fecha_hora,
            observacion=modelo.observacion,
        )

    def esta_aprobado(self, bulto_id: int) -> bool:
        """Indica si el bulto ya cuenta con evidencia inmutable de aprobación."""
        session = self._get_session()
        stmt = select(Aprobacion_Bulto_Model.id).where(Aprobacion_Bulto_Model.bulto_id == bulto_id).limit(1)
        return session.scalars(stmt).first() is not None

    def listar_por_orden(self, orden_id: int) -> list[Aprobacion_Bulto]:
        """Recupera todas las aprobaciones asociadas a los bultos de una orden."""
        session = self._get_session()
        stmt = (
            select(Aprobacion_Bulto_Model)
            .join(Bulto_Model, Bulto_Model.id == Aprobacion_Bulto_Model.bulto_id)
            .where(Bulto_Model.orden_id == orden_id)
            .order_by(Aprobacion_Bulto_Model.id.asc())
        )
        modelos = session.scalars(stmt).all()
        return [
            Aprobacion_Bulto(
                id=m.id,
                bulto_id=m.bulto_id,
                actor=m.actor,
                fecha_hora=m.fecha_hora,
                observacion=m.observacion,
            )
            for m in modelos
        ]
