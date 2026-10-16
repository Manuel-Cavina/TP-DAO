from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.logistica.domain.precinto import Precinto
from modules.logistica.infrastructure.models import Precinto_Model


class Precinto_Repository:
    """Repositorio ORM para persistencia y consulta de precintos."""

    def __init__(self, session: Session | None = None) -> None:
        self._session = session

    def _get_session(self) -> Session:
        return self._session if self._session is not None else Request_Session_Context.obtener_sesion()

    def guardar(self, precinto: Precinto, utilizado: bool = False) -> None:
        """Persiste un nuevo precinto en la base de datos."""
        session = self._get_session()
        modelo = Precinto_Model(
            codigo=precinto.codigo,
            esta_intacto=precinto.esta_intacto,
            utilizado=utilizado,
        )
        session.add(modelo)
        session.flush()

    def obtener_por_codigo(self, codigo: str) -> Precinto | None:
        """Obtiene un precinto por su identificador unico."""
        session = self._get_session()
        modelo = session.get(Precinto_Model, codigo.strip())
        if modelo is None:
            return None
        return Precinto(codigo=modelo.codigo, esta_intacto=modelo.esta_intacto)

    def esta_disponible(self, codigo: str) -> bool:
        """Verifica si el precinto existe, esta intacto y no fue utilizado."""
        session = self._get_session()
        modelo = session.get(Precinto_Model, codigo.strip())
        if modelo is None:
            return False
        return bool(modelo.esta_intacto and not modelo.utilizado)

    def marcar_utilizado(self, codigo: str) -> None:
        """Marca un precinto como utilizado en un bulto."""
        session = self._get_session()
        modelo = session.get(Precinto_Model, codigo.strip())
        if modelo is not None:
            modelo.utilizado = True
            session.flush()

    def actualizar(self, precinto: Precinto) -> None:
        """Actualiza el estado de integridad de un precinto."""
        session = self._get_session()
        modelo = session.get(Precinto_Model, precinto.codigo.strip())
        if modelo is not None:
            modelo.esta_intacto = precinto.esta_intacto
            session.flush()
