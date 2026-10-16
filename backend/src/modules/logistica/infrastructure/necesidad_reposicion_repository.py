from datetime import datetime
import sqlite3
from typing import Any


class Necesidad_Reposicion_Repository:
    """Repositorio SQLite para registrar y consultar necesidades de reposicion generadas por stock o locales."""

    def registrar(
        self,
        connection: sqlite3.Connection,
        producto_id: str,
        local_id: str,
        cantidad: int,
    ) -> int | None:
        """Registra una necesidad si no existe ya una pendiente para el mismo producto y local."""
        if self.existe_pendiente(connection, producto_id, local_id):
            return None

        cursor = connection.execute(
            """
            INSERT INTO necesidades_reposicion (producto_id, local_id, cantidad, estado, fecha_registro)
            VALUES (?, ?, ?, 'PENDIENTE', ?)
            """,
            (producto_id.strip(), local_id.strip(), cantidad, datetime.now().isoformat()),
        )
        return cursor.lastrowid

    def existe_pendiente(
        self, connection: sqlite3.Connection, producto_id: str, local_id: str
    ) -> bool:
        """Verifica si ya existe una necesidad pendiente para evitar duplicaciones (regla Observer)."""
        cursor = connection.execute(
            """
            SELECT id FROM necesidades_reposicion
            WHERE producto_id = ? AND local_id = ? AND estado = 'PENDIENTE'
            """,
            (producto_id.strip(), local_id.strip()),
        )
        return cursor.fetchone() is not None

    def listar_pendientes(
        self, connection: sqlite3.Connection, local_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Lista las necesidades pendientes, opcionalmente filtrando por local."""
        if local_id:
            cursor = connection.execute(
                """
                SELECT id, producto_id, local_id, cantidad, estado, fecha_registro
                FROM necesidades_reposicion
                WHERE estado = 'PENDIENTE' AND local_id = ?
                ORDER BY fecha_registro ASC
                """,
                (local_id.strip(),),
            )
        else:
            cursor = connection.execute(
                """
                SELECT id, producto_id, local_id, cantidad, estado, fecha_registro
                FROM necesidades_reposicion
                WHERE estado = 'PENDIENTE'
                ORDER BY fecha_registro ASC
                """
            )

        return [dict(fila) for fila in cursor.fetchall()]

    def consolidar_en_orden(
        self,
        connection: sqlite3.Connection,
        necesidad_ids: list[int],
        orden_id: int | str,
    ) -> None:
        """Marca una lista de necesidades como consolidadas y las vincula a la orden creada."""
        for nid in necesidad_ids:
            connection.execute(
                """
                UPDATE necesidades_reposicion
                SET estado = 'CONSOLIDADA', orden_id = ?
                WHERE id = ? AND estado = 'PENDIENTE'
                """,
                (int(orden_id), int(nid)),
            )
