"""Conexion SQLite compartida por los repositorios de los modulos."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from collections.abc import Iterator

DATABASE_PATH = Path("runtime/tp_dao.sqlite3")


@contextmanager
def sqlite_connection() -> Iterator[sqlite3.Connection]:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
