"""Factory de sesiones ORM por petición."""

from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker


class Session_Factory:
    """Crea sesiones nuevas; nunca conserva una sesión global."""

    def __init__(self, engine: Engine) -> None:
        self._factory = sessionmaker(bind=engine, autoflush=True, expire_on_commit=False)

    def crear_sesion(self) -> Session:
        """Construye una sesión independiente para la petición actual."""
        return self._factory()
