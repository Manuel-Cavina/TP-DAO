from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.ubicaciones_stock.domain import Ubicacion, crear_ubicacion
from modules.ubicaciones_stock.domain.exceptions import Centro_Distribucion_Duplicado_Exception
from modules.ubicaciones_stock.infrastructure.models import Ubicacion_Model


class Ubicacion_Repository:
    """Repositorio ORM de ubicaciones (CD y locales)."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, ubicacion: Ubicacion) -> Ubicacion:
        modelo = Ubicacion_Model(tipo=ubicacion.tipo)
        self._copiar(ubicacion, modelo)
        session = self._get_session()
        session.add(modelo)
        try:
            session.flush()
        except IntegrityError as error:
            raise Centro_Distribucion_Duplicado_Exception("El sistema admite un único Centro de Distribución.") from error
        ubicacion.id = modelo.id
        return ubicacion

    def actualizar(self, ubicacion: Ubicacion) -> None:
        modelo = self._get_session().get(Ubicacion_Model, ubicacion.id)
        self._copiar(ubicacion, modelo)
        self._get_session().flush()

    def obtener_por_id(self, ubicacion_id: int) -> Ubicacion | None:
        modelo = self._get_session().get(Ubicacion_Model, ubicacion_id)
        return self._a_dominio(modelo) if modelo is not None else None

    def listar(self, tipo: str | None = None, solo_activas: bool = False) -> list[Ubicacion]:
        stmt = select(Ubicacion_Model).order_by(Ubicacion_Model.id)
        if tipo is not None:
            stmt = stmt.where(Ubicacion_Model.tipo == tipo)
        if solo_activas:
            stmt = stmt.where(Ubicacion_Model.activo.is_(True))
        return [self._a_dominio(m) for m in self._get_session().scalars(stmt)]

    @staticmethod
    def _copiar(ubicacion: Ubicacion, modelo: Ubicacion_Model) -> None:
        modelo.nombre = ubicacion.nombre
        modelo.direccion = ubicacion.direccion
        modelo.telefono = ubicacion.telefono
        modelo.activo = ubicacion.activo

    @staticmethod
    def _a_dominio(modelo: Ubicacion_Model) -> Ubicacion:
        return crear_ubicacion(
            modelo.tipo,
            nombre=modelo.nombre,
            direccion=modelo.direccion,
            telefono=modelo.telefono,
            id=modelo.id,
            activo=modelo.activo,
        )
