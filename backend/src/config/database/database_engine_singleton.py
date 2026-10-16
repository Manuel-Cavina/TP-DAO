"""Singleton del engine SQLAlchemy de la aplicación."""

from __future__ import annotations

from os import getenv
from pathlib import Path

from sqlalchemy import Engine, create_engine, event

from config.database.session_factory import Session_Factory


class Database_Engine_Singleton:
    """Conserva el único engine y su factory de sesiones por aplicación."""

    _engine: Engine | None = None
    _session_factory: Session_Factory | None = None
    _database_url: str | None = None

    @classmethod
    def obtener_instancia(cls, database_url: str | None = None) -> Engine:
        """Obtiene el engine compartido, creándolo una única vez."""
        url = database_url or cls._obtener_url_configurada()
        if not url.startswith("sqlite"):
            raise ValueError("La configuración transversal actual sólo admite URLs SQLite.")
        if cls._engine is None:
            cls._preparar_directorio_sqlite(url)
            cls._engine = create_engine(
                url,
                connect_args={"check_same_thread": False, "timeout": 30},
            )
            cls._database_url = url
            cls._habilitar_claves_foraneas(cls._engine)
            cls._session_factory = Session_Factory(cls._engine)
        elif cls._database_url != url:
            raise RuntimeError("El engine de base de datos ya fue inicializado con otra URL.")
        return cls._engine

    @classmethod
    def obtener_session_factory(cls) -> Session_Factory:
        """Devuelve la factory asociada al engine global ya inicializado."""
        if cls._session_factory is None:
            cls.obtener_instancia()
        assert cls._session_factory is not None
        return cls._session_factory

    @classmethod
    def reiniciar_para_pruebas(cls) -> None:
        """Libera recursos globales; sólo debe invocarse desde pruebas."""
        if cls._engine is not None:
            cls._engine.dispose()
        cls._engine = None
        cls._session_factory = None
        cls._database_url = None

    @staticmethod
    def _obtener_url_configurada() -> str:
        url = getenv("ERP_DATABASE_URL")
        if url:
            return url
        archivo = Path(__file__).resolve().parents[3] / "runtime" / "erp.sqlite3"
        return f"sqlite:///{archivo.as_posix()}"

    @staticmethod
    def _preparar_directorio_sqlite(database_url: str) -> None:
        prefijo = "sqlite:///"
        if database_url.startswith(prefijo) and database_url != "sqlite:///:memory:":
            Path(database_url.removeprefix(prefijo)).parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _habilitar_claves_foraneas(engine: Engine) -> None:
        @event.listens_for(engine, "connect")
        def activar_foreign_keys(dbapi_connection: object, _connection_record: object) -> None:
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            try:
                cursor.execute("PRAGMA foreign_keys=ON")
            finally:
                cursor.close()
