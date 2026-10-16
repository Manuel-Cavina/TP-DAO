from datetime import datetime
import sqlite3

from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository


class Remito_Repository:
    """Repositorio SQLite para persistir y recuperar remitos de despacho."""

    def __init__(self, bulto_repository: Bulto_Repository | None = None) -> None:
        self._bulto_repository = (
            bulto_repository if bulto_repository is not None else Bulto_Repository()
        )

    def guardar(self, connection: sqlite3.Connection, remito: Remito) -> Remito:
        """Inserta un remito y asocia los bultos incluidos."""
        connection.execute(
            """
            INSERT INTO remitos (numero, origen_id, destino_id, fecha_emision, estado)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                remito.numero,
                remito.origen_id,
                remito.destino_id,
                remito.fecha_emision.isoformat(),
                remito.estado,
            ),
        )

        for b in remito.bultos:
            if b.id is not None:
                connection.execute(
                    "UPDATE bultos SET remito_numero = ? WHERE id = ?",
                    (remito.numero, int(b.id)),
                )

        return remito

    def actualizar(self, connection: sqlite3.Connection, remito: Remito) -> None:
        """Actualiza el estado de un remito."""
        connection.execute(
            "UPDATE remitos SET estado = ? WHERE numero = ?",
            (remito.estado, remito.numero),
        )

    def obtener_por_numero(
        self, connection: sqlite3.Connection, numero: str
    ) -> Remito | None:
        """Busca un remito por su numero y carga sus bultos correspondientes."""
        cursor = connection.execute(
            "SELECT numero, origen_id, destino_id, fecha_emision, estado FROM remitos WHERE numero = ?",
            (numero.strip(),),
        )
        fila = cursor.fetchone()
        if fila is None:
            return None

        bultos = self._bulto_repository.listar_por_remito(connection, numero.strip())
        return Remito(
            numero=fila["numero"],
            origen_id=fila["origen_id"],
            destino_id=fila["destino_id"],
            fecha_emision=datetime.fromisoformat(fila["fecha_emision"]),
            estado=fila["estado"],
            bultos=bultos,
        )

    def listar_todos(self, connection: sqlite3.Connection) -> list[Remito]:
        """Devuelve todos los remitos emitidos en el sistema."""
        cursor = connection.execute(
            "SELECT numero, origen_id, destino_id, fecha_emision, estado FROM remitos ORDER BY fecha_emision DESC"
        )
        remitos: list[Remito] = []
        for fila in cursor.fetchall():
            num = fila["numero"]
            bultos = self._bulto_repository.listar_por_remito(connection, num)
            remitos.append(
                Remito(
                    numero=num,
                    origen_id=fila["origen_id"],
                    destino_id=fila["destino_id"],
                    fecha_emision=datetime.fromisoformat(fila["fecha_emision"]),
                    estado=fila["estado"],
                    bultos=bultos,
                )
            )
        return remitos
