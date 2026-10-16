from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.infrastructure.models import Necesidad_Reposicion_Model


class Necesidad_Reposicion_Repository:
    """Repositorio ORM para registrar y consultar necesidades de reposicion."""

    def __init__(self, session: Session | None = None) -> None:
        self._session = session

    def _get_session(self) -> Session:
        return self._session if self._session is not None else Request_Session_Context.obtener_sesion()

    def registrar(
        self,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> int | None:
        """Registra una necesidad si no existe ya una pendiente para el producto y local."""
        session = self._get_session()
        if self.existe_pendiente(producto_id, local_id):
            return None

        modelo = Necesidad_Reposicion_Model(
            producto_id=producto_id.strip(),
            local_id=local_id.strip(),
            cantidad=cantidad,
            estado="PENDIENTE",
        )
        session.add(modelo)
        session.flush()
        return modelo.id

    def existe_pendiente(self, producto_id: str, local_id: str) -> bool:
        """Verifica si ya existe una necesidad pendiente para evitar duplicados."""
        session = self._get_session()
        stmt = select(Necesidad_Reposicion_Model).where(
            Necesidad_Reposicion_Model.producto_id == producto_id.strip(),
            Necesidad_Reposicion_Model.local_id == local_id.strip(),
            Necesidad_Reposicion_Model.estado == "PENDIENTE",
        )
        return session.scalars(stmt).first() is not None

    def listar_pendientes(
        self, local_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Lista las necesidades pendientes, con filtro opcional por local."""
        session = self._get_session()
        stmt = select(Necesidad_Reposicion_Model).where(
            Necesidad_Reposicion_Model.estado == "PENDIENTE"
        )
        if local_id:
            stmt = stmt.where(Necesidad_Reposicion_Model.local_id == local_id.strip())

        stmt = stmt.order_by(Necesidad_Reposicion_Model.fecha_registro.asc())
        modelos = session.scalars(stmt).all()
        return [
            {
                "id": m.id,
                "producto_id": m.producto_id,
                "local_id": m.local_id,
                "cantidad": m.cantidad,
                "estado": m.estado,
                "fecha_registro": m.fecha_registro.isoformat() if m.fecha_registro else None,
            }
            for m in modelos
        ]

    def consolidar_en_orden(
        self,
        necesidad_ids: list[int],
        orden_id: int | str,
    ) -> None:
        """Marca una lista de necesidades como consolidadas y las vincula a la orden."""
        session = self._get_session()
        for nid in necesidad_ids:
            modelo = session.get(Necesidad_Reposicion_Model, int(nid))
            if modelo is not None and modelo.estado == "PENDIENTE":
                modelo.estado = "CONSOLIDADA"
                modelo.orden_id = int(orden_id)
        session.flush()
