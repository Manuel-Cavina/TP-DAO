"""Inicialización transitoria del esquema de módulos aún no migrados."""

from pathlib import Path

from sqlalchemy import Engine


def inicializar_esquema_heredado(engine: Engine) -> None:
    """Aplica el DDL heredado sólo mientras existan repositories sqlite3.

    Se retira cuando las fases ORM de catálogo y stock hayan registrado sus
    entidades. El esquema nuevo sigue siendo propiedad de ``Base.metadata``.
    """
    archivo = Path(__file__).resolve().parents[1] / "schema.sql"
    script = archivo.read_text(encoding="utf-8")
    conexion = engine.raw_connection()
    try:
        conexion.driver_connection.executescript(script)
    finally:
        conexion.close()
