"""Migraciones aditivas y seguras para bases SQLite ya existentes."""

from sqlalchemy import Engine, text


def aplicar_migraciones_sqlite(engine: Engine) -> None:
    """Actualiza columnas que ``create_all`` no puede agregar a tablas existentes."""
    with engine.begin() as connection:
        tablas = {
            row[0]
            for row in connection.execute(text("SELECT name FROM sqlite_master WHERE type = 'table'"))
        }
        if "ubicaciones" in tablas:
            connection.execute(text("DROP INDEX IF EXISTS uq_ubicacion_unico_cd"))
        if "remitos" not in tablas:
            return

        columnas = {row[1] for row in connection.execute(text("PRAGMA table_info(remitos)"))}
        if "orden_id" not in columnas:
            connection.execute(text("ALTER TABLE remitos ADD COLUMN orden_id INTEGER"))

        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_remitos_orden_id ON remitos (orden_id)"))
        if "bultos" in tablas:
            connection.execute(
                text(
                    """
                    UPDATE remitos
                    SET orden_id = (
                        SELECT orden_id FROM bultos
                        WHERE bultos.remito_numero = remitos.numero
                        ORDER BY bultos.id
                        LIMIT 1
                    )
                    WHERE orden_id IS NULL
                    """
                )
            )
