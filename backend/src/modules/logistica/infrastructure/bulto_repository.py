from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.estado_bulto import crear_estado_bulto_desde_string
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.domain.precinto import Precinto
from modules.logistica.infrastructure.models import (
    Bulto_Model,
    Detalle_Bulto_Model,
    Historial_Bulto_Model,
)


class Bulto_Repository:
    """Repositorio ORM para persistir y reconstruir bultos, detalles e historial inmutable."""

    def __init__(self, session: Session | None = None) -> None:
        self._session = session

    def _get_session(self) -> Session:
        return self._session if self._session is not None else Request_Session_Context.obtener_sesion()

    def guardar(self, bulto: Bulto, remito_numero: str | None = None) -> Bulto:
        """Inserta un bulto nuevo, sus detalles e historial mediante el ORM."""
        session = self._get_session()
        modelo = Bulto_Model(
            orden_id=int(bulto.orden_id),
            remito_numero=remito_numero,
            codigo_precinto=bulto.precinto.codigo if bulto.precinto else None,
            estado=bulto.estado.nombre,
        )
        for d in bulto.detalles:
            modelo.detalles.append(
                Detalle_Bulto_Model(producto_id=d.producto_id, cantidad=d.cantidad)
            )

        for h in bulto.historial:
            modelo.historial.append(
                Historial_Bulto_Model(
                    estado_anterior=h.estado_anterior,
                    estado_nuevo=h.estado_nuevo,
                    fecha_hora=h.fecha_hora,
                    observacion=h.observacion,
                )
            )

        session.add(modelo)
        session.flush()
        bulto.id = modelo.id
        return bulto

    def actualizar(self, bulto: Bulto, remito_numero: str | None = None) -> None:
        """Actualiza el estado de un bulto y sincroniza su historial inmutable."""
        if bulto.id is None:
            raise ValueError("No se puede actualizar un bulto sin id persistido.")

        session = self._get_session()
        modelo = session.get(Bulto_Model, int(bulto.id))
        if modelo is None:
            raise ValueError(f"No se encontro el bulto {bulto.id} para actualizar.")

        modelo.estado = bulto.estado.nombre
        modelo.codigo_precinto = bulto.precinto.codigo if bulto.precinto else None
        if remito_numero is not None:
            modelo.remito_numero = remito_numero

        total_existentes = len(modelo.historial)
        nuevos_hitos = bulto.historial[total_existentes:]
        for h in nuevos_hitos:
            modelo.historial.append(
                Historial_Bulto_Model(
                    estado_anterior=h.estado_anterior,
                    estado_nuevo=h.estado_nuevo,
                    fecha_hora=h.fecha_hora,
                    observacion=h.observacion,
                )
            )

        session.flush()

    def obtener_por_id(self, bulto_id: int | str) -> Bulto | None:
        """Carga un bulto por su ID y reconstruye la entidad de dominio."""
        session = self._get_session()
        modelo = session.get(Bulto_Model, int(bulto_id))
        if modelo is None:
            return None
        return self._reconstruir_bulto(modelo)

    def listar_por_orden(self, orden_id: int | str) -> list[Bulto]:
        """Obtiene todos los bultos asociados a una orden de reposicion."""
        session = self._get_session()
        stmt = select(Bulto_Model).where(Bulto_Model.orden_id == int(orden_id)).order_by(Bulto_Model.id.asc())
        modelos = session.scalars(stmt).unique().all()
        return [self._reconstruir_bulto(m) for m in modelos]

    def listar_por_remito(self, remito_numero: str) -> list[Bulto]:
        """Obtiene todos los bultos incluidos en un remito."""
        session = self._get_session()
        stmt = (
            select(Bulto_Model)
            .where(Bulto_Model.remito_numero == remito_numero.strip())
            .order_by(Bulto_Model.id.asc())
        )
        modelos = session.scalars(stmt).unique().all()
        return [self._reconstruir_bulto(m) for m in modelos]

    def listar_todos(self) -> list[Bulto]:
        """Lista todos los bultos registrados en el sistema."""
        session = self._get_session()
        stmt = select(Bulto_Model).order_by(Bulto_Model.id.desc())
        modelos = session.scalars(stmt).unique().all()
        return [self._reconstruir_bulto(m) for m in modelos]

    def _reconstruir_bulto(self, modelo: Bulto_Model) -> Bulto:
        estado = crear_estado_bulto_desde_string(modelo.estado)
        precinto = None
        if modelo.precinto is not None:
            precinto = Precinto(codigo=modelo.precinto.codigo, esta_intacto=modelo.precinto.esta_intacto)
        elif modelo.codigo_precinto:
            precinto = Precinto(codigo=modelo.codigo_precinto, esta_intacto=True)

        detalles = [
            Detalle_Bulto(producto_id=d.producto_id, cantidad=d.cantidad)
            for d in modelo.detalles
        ]
        historial = [
            Historial_Bulto(
                bulto_id=h.bulto_id,
                estado_anterior=h.estado_anterior,
                estado_nuevo=h.estado_nuevo,
                fecha_hora=h.fecha_hora,
                observacion=h.observacion,
            )
            for h in modelo.historial
        ]

        return Bulto(
            id=modelo.id,
            orden_id=modelo.orden_id,
            estado=estado,
            precinto=precinto,
            detalles=detalles,
            historial=historial,
        )
