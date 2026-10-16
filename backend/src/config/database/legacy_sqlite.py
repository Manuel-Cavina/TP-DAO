"""Adaptador temporal para módulos pendientes de migración ORM.

Dentro de HTTP reutiliza la conexión de la sesión activa; así los módulos
heredados participan de la transacción delimitada por el middleware. No debe
usarse en código nuevo y se elimina al completar las fases ORM de módulo.
"""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from config.database.request_session_context import Request_Session_Context

DATABASE_PATH = Path(__file__).resolve().parents[3] / "runtime" / "erp.sqlite3"


@contextmanager
def sqlite_connection() -> Iterator[sqlite3.Connection]:
    """Compatibilidad temporal que respeta la transacción HTTP si existe."""
    try:
        sesion = Request_Session_Context.obtener_sesion()
    except RuntimeError:
        sesion = None

    if sesion is not None:
        conexion_sqlalchemy = sesion.connection()
        connection = conexion_sqlalchemy.connection.driver_connection
        connection.row_factory = sqlite3.Row
        yield connection
        return

    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
