from datetime import datetime
import sqlite3

from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.orden_reposicion import Orden_Reposicion


class Orden_Reposicion_Repository:
    """Repositorio SQLite para ordenes de reposicion y sus detalles."""

    def guardar(
        self, connection: sqlite3.Connection, orden: Orden_Reposicion
    ) -> Orden_Reposicion:
        """Inserta una nueva orden de reposicion con sus detalles."""
        cursor = connection.execute(
            """
            INSERT INTO ordenes_reposicion (origen_id, destino_id, fecha, estado)
            VALUES (?, ?, ?, ?)
            """,
            (orden.origen_id, orden.destino_id, orden.fecha.isoformat(), orden.estado),
        )
        orden_id = cursor.lastrowid
        orden.id = orden_id

        for d in orden.detalles:
            connection.execute(
                """
                INSERT INTO detalles_orden_reposicion (orden_id, producto_id, cantidad_solicitada, cantidad_enviada)
                VALUES (?, ?, ?, ?)
                """,
                (orden_id, d.producto_id, d.cantidad_solicitada, d.cantidad_enviada),
            )

        return orden

    def actualizar(
        self, connection: sqlite3.Connection, orden: Orden_Reposicion
    ) -> None:
        """Actualiza el estado de la orden y las cantidades enviadas de sus detalles."""
        if orden.id is None:
            raise ValueError("No se puede actualizar una orden sin id persistido.")

        connection.execute(
            "UPDATE ordenes_reposicion SET estado = ? WHERE id = ?",
            (orden.estado, int(orden.id)),
        )

        for d in orden.detalles:
            connection.execute(
                """
                UPDATE detalles_orden_reposicion
                SET cantidad_enviada = ?
                WHERE orden_id = ? AND producto_id = ?
                """,
                (d.cantidad_enviada, int(orden.id), d.producto_id),
            )

    def obtener_por_id(
        self, connection: sqlite3.Connection, orden_id: int | str
    ) -> Orden_Reposicion | None:
        """Busca una orden de reposicion por identificador."""
        cursor = connection.execute(
            "SELECT id, origen_id, destino_id, fecha, estado FROM ordenes_reposicion WHERE id = ?",
            (int(orden_id),),
        )
        fila = cursor.fetchone()
        if fila is None:
            return None

        return self._reconstruir_orden(connection, fila)

    def listar_todas(self, connection: sqlite3.Connection) -> list[Orden_Reposicion]:
        """Devuelve todas las ordenes registradas."""
        cursor = connection.execute(
            "SELECT id, origen_id, destino_id, fecha, estado FROM ordenes_reposicion ORDER BY id DESC"
        )
        return [self._reconstruir_orden(connection, f) for f in cursor.fetchall()]

    def listar_por_estado(
        self, connection: sqlite3.Connection, estado: str
    ) -> list[Orden_Reposicion]:
        """Filtra ordenes por su estado."""
        cursor = connection.execute(
            "SELECT id, origen_id, destino_id, fecha, estado FROM ordenes_reposicion WHERE estado = ? ORDER BY id DESC",
            (estado.strip().upper(),),
        )
        return [self._reconstruir_orden(connection, f) for f in cursor.fetchall()]

    def _reconstruir_orden(
        self, connection: sqlite3.Connection, fila: sqlite3.Row
    ) -> Orden_Reposicion:
        orden_id = fila["id"]
        cur_detalles = connection.execute(
            """
            SELECT producto_id, cantidad_solicitada, cantidad_enviada
            FROM detalles_orden_reposicion
            WHERE orden_id = ?
            ORDER BY id ASC
            """,
            (orden_id,),
        )
        detalles = [
            Detalle_Orden_Reposicion(
                producto_id=fd["producto_id"],
                cantidad_solicitada=fd["cantidad_solicitada"],
                cantidad_enviada=fd["cantidad_enviada"],
            )
            for fd in cur_detalles.fetchall()
        ]

        return Orden_Reposicion(
            id=orden_id,
            origen_id=fila["origen_id"],
            destino_id=fila["destino_id"],
            fecha=datetime.fromisoformat(fila["fecha"]),
            estado=fila["estado"],
            detalles=detalles,
        )
