from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.control_precinto import Control_Precinto
from modules.logistica.infrastructure.models import Control_Precinto_Model


class Control_Precinto_Repository:
    """Repositorio para la persistencia de controles de precintos (US5 / T056)."""

    def __init__(self, session: Session | None = None) -> None:
        self._session = session

    def _get_session(self) -> Session:
        return self._session if self._session is not None else Request_Session_Context.obtener_sesion()

    def guardar(self, control: Control_Precinto) -> Control_Precinto:
        session = self._get_session()
        modelo = Control_Precinto_Model(
            bulto_id=control.bulto_id,
            codigo_esperado=control.codigo_esperado,
            codigo_leido=control.codigo_leido,
            resultado=control.resultado,
            motivo_rechazo=control.motivo_rechazo,
            actor=control.actor,
            ubicacion_id=control.ubicacion_id,
            fecha_hora=control.fecha_hora,
            version_bulto=control.version_bulto,
        )
        session.add(modelo)
        session.flush()
        control.id = modelo.id
        return control

    def obtener_por_bulto(self, bulto_id: int) -> Control_Precinto | None:
        session = self._get_session()
        stmt = (
            select(Control_Precinto_Model)
            .where(Control_Precinto_Model.bulto_id == bulto_id)
            .order_by(Control_Precinto_Model.id.desc())
            .limit(1)
        )
        modelo = session.scalars(stmt).first()
        if modelo is None:
            return None
        return Control_Precinto(
            id=modelo.id,
            bulto_id=modelo.bulto_id,
            codigo_esperado=modelo.codigo_esperado,
            codigo_leido=modelo.codigo_leido,
            resultado=modelo.resultado,
            motivo_rechazo=modelo.motivo_rechazo,
            actor=modelo.actor,
            ubicacion_id=modelo.ubicacion_id,
            fecha_hora=modelo.fecha_hora,
            version_bulto=modelo.version_bulto,
        )

    def obtener_por_bulto_id(self, bulto_id: int) -> Control_Precinto | None:
        """Alias para obtener_por_bulto."""
        return self.obtener_por_bulto(bulto_id)

    def listar_por_bultos(self, bulto_ids: list[int]) -> list[Control_Precinto]:
        if not bulto_ids:
            return []
        session = self._get_session()
        stmt = (
            select(Control_Precinto_Model)
            .where(Control_Precinto_Model.bulto_id.in_(bulto_ids))
            .order_by(Control_Precinto_Model.id.asc())
        )
        modelos = session.scalars(stmt).all()
        return [
            Control_Precinto(
                id=m.id,
                bulto_id=m.bulto_id,
                codigo_esperado=m.codigo_esperado,
                codigo_leido=m.codigo_leido,
                resultado=m.resultado,
                motivo_rechazo=m.motivo_rechazo,
                actor=m.actor,
                ubicacion_id=m.ubicacion_id,
                fecha_hora=m.fecha_hora,
                version_bulto=m.version_bulto,
            )
            for m in modelos
        ]
