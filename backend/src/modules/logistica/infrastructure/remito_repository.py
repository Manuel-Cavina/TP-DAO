from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.exceptions import Remito_Duplicado_Exception
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.models import Bulto_Model, Remito_Model


class Remito_Repository:
    """Repositorio ORM para persistir y recuperar remitos de despacho."""

    def __init__(self, bulto_repository: Bulto_Repository | None = None) -> None:
        self._bulto_repository = bulto_repository if bulto_repository is not None else Bulto_Repository()

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, remito: Remito) -> Remito:
        """Inserta un remito y asocia los bultos incluidos en la misma sesion."""
        session = self._get_session()
        modelo = Remito_Model(
            numero=remito.numero,
            origen_id=remito.origen_id,
            destino_id=remito.destino_id,
            fecha_emision=remito.fecha_emision,
            estado=remito.estado,
        )
        session.add(modelo)
        try:
            session.flush()
        except IntegrityError as error:
            # Sin SAVEPOINT: la peticion termina en error y el middleware revierte la transaccion.
            # Dos peticiones simultaneas con el mismo numero: la PK lo detecta y se informa como 409.
            raise Remito_Duplicado_Exception(f"Ya existe un remito con numero '{remito.numero}'.") from error

        for b in remito.bultos:
            if b.id is not None:
                bulto_mod = session.get(Bulto_Model, b.id)
                if bulto_mod is not None:
                    bulto_mod.remito_numero = remito.numero

        session.flush()
        return remito

    def estado(self, numero: str) -> str | None:
        """Estado del remito sin reconstruir sus bultos, o None si no existe."""
        modelo = self._get_session().get(Remito_Model, numero.strip())
        return modelo.estado if modelo is not None else None

    def existe(self, numero: str) -> bool:
        return self._get_session().get(Remito_Model, numero.strip()) is not None

    def actualizar(self, remito: Remito) -> None:
        """Actualiza el estado de un remito."""
        session = self._get_session()
        modelo = session.get(Remito_Model, remito.numero.strip())
        if modelo is not None:
            modelo.estado = remito.estado
            session.flush()

    def obtener_por_numero(self, numero: str) -> Remito | None:
        """Busca un remito por su numero y carga sus bultos correspondientes."""
        session = self._get_session()
        modelo = session.get(Remito_Model, numero.strip())
        if modelo is None:
            return None

        bultos = self._bulto_repository.listar_por_remito(numero.strip())
        return Remito(
            numero=modelo.numero,
            origen_id=modelo.origen_id,
            destino_id=modelo.destino_id,
            fecha_emision=modelo.fecha_emision,
            estado=modelo.estado,
            bultos=bultos,
        )

    def listar_todos(self) -> list[Remito]:
        """Devuelve todos los remitos emitidos en el sistema."""
        session = self._get_session()
        stmt = select(Remito_Model).order_by(Remito_Model.fecha_emision.desc())
        modelos = session.scalars(stmt).unique().all()
        remitos: list[Remito] = []
        for m in modelos:
            bultos = self._bulto_repository.listar_por_remito(m.numero)
            remitos.append(
                Remito(
                    numero=m.numero,
                    origen_id=m.origen_id,
                    destino_id=m.destino_id,
                    fecha_emision=m.fecha_emision,
                    estado=m.estado,
                    bultos=bultos,
                )
            )
        return remitos
