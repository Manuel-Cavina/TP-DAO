from datetime import datetime
import sqlite3

from modules.logistica.domain.historial_bulto import Historial_Bulto


class Historial_Bulto_Repository:
    """Repositorio inmutable para auditoria y trazabilidad historica de bultos."""

    def guardar(
        self, connection: sqlite3.Connection, historial: Historial_Bulto
    ) -> None:
        """Inserta un nuevo hito inmutable en el historial."""
        query = """
        INSERT INTO historial_bultos (bulto_id, estado_anterior, estado_nuevo, fecha_hora, observacion)
        VALUES (?, ?, ?, ?, ?)
        """
        connection.execute(
            query,
            (
                int(historial.bulto_id),
                historial.estado_anterior,
                historial.estado_nuevo,
                historial.fecha_hora.isoformat(),
                historial.observacion,
            ),
        )

    def listar_por_bulto(
        self, connection: sqlite3.Connection, bulto_id: int | str
    ) -> list[Historial_Bulto]:
        """Obtiene la secuencia historica ordenada de transiciones de un bulto."""
        query = """
        SELECT bulto_id, estado_anterior, estado_nuevo, fecha_hora, observacion
        FROM historial_bultos
        WHERE bulto_id = ?
        ORDER BY id ASC
        """
        cursor = connection.execute(query, (int(bulto_id),))
        filas = cursor.fetchall()
        return [
            Historial_Bulto(
                bulto_id=fila["bulto_id"],
                estado_anterior=fila["estado_anterior"],
                estado_nuevo=fila["estado_nuevo"],
                fecha_hora=datetime.fromisoformat(fila["fecha_hora"]),
                observacion=fila["observacion"],
            )
            for fila in filas
        ]
