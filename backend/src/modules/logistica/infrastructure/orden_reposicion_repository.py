from sqlalchemy import select

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.infrastructure.models import (
    Detalle_Orden_Reposicion_Model,
    Orden_Reposicion_Model,
)


class Orden_Reposicion_Repository:
    """Repositorio ORM para persistencia y consulta de ordenes de reposicion y sus detalles."""

    @staticmethod
    def _get_session():
        return Request_Session_Context.obtener_sesion()

    def guardar(self, orden: Orden_Reposicion) -> Orden_Reposicion:
        """Persiste una orden nueva con sus items asociados."""
        session = self._get_session()
        modelo = Orden_Reposicion_Model(
            origen_id=orden.origen_id,
            destino_id=orden.destino_id,
            fecha=orden.fecha,
            estado=orden.estado,
        )
        for d in orden.detalles:
            modelo.detalles.append(
                Detalle_Orden_Reposicion_Model(
                    producto_id=d.producto_id,
                    cantidad_solicitada=d.cantidad_solicitada,
                    cantidad_enviada=d.cantidad_enviada,
                )
            )

        session.add(modelo)
        session.flush()
        orden.id = modelo.id
        return orden

    def actualizar(self, orden: Orden_Reposicion) -> None:
        """Actualiza el estado de la orden y las cantidades enviadas."""
        if orden.id is None:
            raise ValueError("No se puede actualizar una orden sin ID asignado.")

        session = self._get_session()
        modelo = session.get(Orden_Reposicion_Model, int(orden.id))
        if modelo is None:
            raise ValueError(f"No se encontro la orden {orden.id} para actualizar.")

        modelo.estado = orden.estado
        for d in orden.detalles:
            detalle_mod = next(
                (dm for dm in modelo.detalles if dm.producto_id == d.producto_id), None
            )
            if detalle_mod:
                detalle_mod.cantidad_enviada = d.cantidad_enviada

        session.flush()

    def obtener_por_id(self, orden_id: int) -> Orden_Reposicion | None:
        """Obtiene una orden por ID y reconstruye la entidad de dominio."""
        session = self._get_session()
        modelo = session.get(Orden_Reposicion_Model, orden_id)
        if modelo is None:
            return None
        return self._reconstruir_orden(modelo)

    def listar_todas(self) -> list[Orden_Reposicion]:
        """Devuelve todas las ordenes registradas."""
        session = self._get_session()
        stmt = select(Orden_Reposicion_Model).order_by(Orden_Reposicion_Model.id.desc())
        modelos = session.scalars(stmt).unique().all()
        return [self._reconstruir_orden(m) for m in modelos]

    def listar_por_estado(self, estado: str) -> list[Orden_Reposicion]:
        """Filtra ordenes por su estado."""
        session = self._get_session()
        stmt = (
            select(Orden_Reposicion_Model)
            .where(Orden_Reposicion_Model.estado == estado.strip().upper())
            .order_by(Orden_Reposicion_Model.id.desc())
        )
        modelos = session.scalars(stmt).unique().all()
        return [self._reconstruir_orden(m) for m in modelos]

    def _reconstruir_orden(self, modelo: Orden_Reposicion_Model) -> Orden_Reposicion:
        detalles = [
            Detalle_Orden_Reposicion(
                producto_id=d.producto_id,
                cantidad_solicitada=d.cantidad_solicitada,
                cantidad_enviada=d.cantidad_enviada,
            )
            for d in modelo.detalles
        ]
        return Orden_Reposicion(
            id=modelo.id,
            origen_id=modelo.origen_id,
            destino_id=modelo.destino_id,
            fecha=modelo.fecha,
            estado=modelo.estado,
            detalles=detalles,
        )
