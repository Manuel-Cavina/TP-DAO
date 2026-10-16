from datetime import datetime
import sqlite3

from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.estado_bulto import crear_estado_bulto_desde_string
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.domain.precinto import Precinto


class Bulto_Repository:
    """Repositorio SQLite para persistir y reconstruir bultos con sus detalles e historial."""

    def guardar(
        self,
        connection: sqlite3.Connection,
        bulto: Bulto,
        remito_numero: str | None = None,
    ) -> Bulto:
        """Inserta un bulto nuevo, sus detalles y sus registros iniciales de historial."""
        cursor = connection.execute(
            """
            INSERT INTO bultos (orden_id, remito_numero, codigo_precinto, estado)
            VALUES (?, ?, ?, ?)
            """,
            (
                int(bulto.orden_id),
                remito_numero,
                bulto.precinto.codigo if bulto.precinto else None,
                bulto.estado.nombre,
            ),
        )
        bulto_id = cursor.lastrowid
        bulto.id = bulto_id

        for d in bulto.detalles:
            connection.execute(
                """
                INSERT INTO detalles_bulto (bulto_id, producto_id, cantidad)
                VALUES (?, ?, ?)
                """,
                (bulto_id, d.producto_id, d.cantidad),
            )

        for h in bulto.historial:
            connection.execute(
                """
                INSERT INTO historial_bultos (bulto_id, estado_anterior, estado_nuevo, fecha_hora, observacion)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    bulto_id,
                    h.estado_anterior,
                    h.estado_nuevo,
                    h.fecha_hora.isoformat(),
                    h.observacion,
                ),
            )

        return bulto

    def actualizar(
        self,
        connection: sqlite3.Connection,
        bulto: Bulto,
        remito_numero: str | None = None,
    ) -> None:
        """Actualiza el estado, precinto y remito de un bulto e inserta nuevos hitos en su historial."""
        if bulto.id is None:
            raise ValueError("No se puede actualizar un bulto sin id persistido.")

        if remito_numero is not None:
            connection.execute(
                """
                UPDATE bultos
                SET remito_numero = ?, codigo_precinto = ?, estado = ?
                WHERE id = ?
                """,
                (
                    remito_numero,
                    bulto.precinto.codigo if bulto.precinto else None,
                    bulto.estado.nombre,
                    int(bulto.id),
                ),
            )
        else:
            connection.execute(
                """
                UPDATE bultos
                SET codigo_precinto = ?, estado = ?
                WHERE id = ?
                """,
                (
                    bulto.precinto.codigo if bulto.precinto else None,
                    bulto.estado.nombre,
                    int(bulto.id),
                ),
            )

        # Sincronizar historial: insertar los registros que todavia no esten persistidos
        cursor_hist = connection.execute(
            "SELECT COUNT(*) as total FROM historial_bultos WHERE bulto_id = ?",
            (int(bulto.id),),
        )
        total_persistidos = cursor_hist.fetchone()["total"]

        nuevos_hitos = bulto.historial[total_persistidos:]
        for h in nuevos_hitos:
            connection.execute(
                """
                INSERT INTO historial_bultos (bulto_id, estado_anterior, estado_nuevo, fecha_hora, observacion)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    int(bulto.id),
                    h.estado_anterior,
                    h.estado_nuevo,
                    h.fecha_hora.isoformat(),
                    h.observacion,
                ),
            )

    def obtener_por_id(
        self, connection: sqlite3.Connection, bulto_id: int | str
    ) -> Bulto | None:
        """Carga un bulto por su identificador primario."""
        cursor = connection.execute(
            "SELECT id, orden_id, remito_numero, codigo_precinto, estado FROM bultos WHERE id = ?",
            (int(bulto_id),),
        )
        fila = cursor.fetchone()
        if fila is None:
            return None

        return self._reconstruir_bulto(connection, fila)

    def listar_por_orden(
        self, connection: sqlite3.Connection, orden_id: int | str
    ) -> list[Bulto]:
        """Obtiene todos los bultos asociados a una orden de reposicion."""
        cursor = connection.execute(
            "SELECT id, orden_id, remito_numero, codigo_precinto, estado FROM bultos WHERE orden_id = ? ORDER BY id ASC",
            (int(orden_id),),
        )
        return [self._reconstruir_bulto(connection, fila) for fila in cursor.fetchall()]

    def listar_por_remito(
        self, connection: sqlite3.Connection, remito_numero: str
    ) -> list[Bulto]:
        """Obtiene todos los bultos incluidos en un remito de despacho."""
        cursor = connection.execute(
            "SELECT id, orden_id, remito_numero, codigo_precinto, estado FROM bultos WHERE remito_numero = ? ORDER BY id ASC",
            (remito_numero.strip(),),
        )
        return [self._reconstruir_bulto(connection, fila) for fila in cursor.fetchall()]

    def listar_todos(self, connection: sqlite3.Connection) -> list[Bulto]:
        """Lista todos los bultos registrados en el sistema."""
        cursor = connection.execute(
            "SELECT id, orden_id, remito_numero, codigo_precinto, estado FROM bultos ORDER BY id DESC"
        )
        return [self._reconstruir_bulto(connection, fila) for fila in cursor.fetchall()]

    def _reconstruir_bulto(
        self, connection: sqlite3.Connection, fila: sqlite3.Row
    ) -> Bulto:
        bulto_id = fila["id"]
        orden_id = fila["orden_id"]
        estado = crear_estado_bulto_desde_string(fila["estado"])

        precinto = None
        if fila["codigo_precinto"]:
            cur_p = connection.execute(
                "SELECT codigo, esta_intacto FROM precintos WHERE codigo = ?",
                (fila["codigo_precinto"],),
            )
            fila_p = cur_p.fetchone()
            if fila_p:
                precinto = Precinto(
                    codigo=fila_p["codigo"], esta_intacto=bool(fila_p["esta_intacto"])
                )

        cur_d = connection.execute(
            "SELECT producto_id, cantidad FROM detalles_bulto WHERE bulto_id = ? ORDER BY id ASC",
            (bulto_id,),
        )
        detalles = [
            Detalle_Bulto(producto_id=fd["producto_id"], cantidad=fd["cantidad"])
            for fd in cur_d.fetchall()
        ]

        cur_h = connection.execute(
            "SELECT bulto_id, estado_anterior, estado_nuevo, fecha_hora, observacion FROM historial_bultos WHERE bulto_id = ? ORDER BY id ASC",
            (bulto_id,),
        )
        historial = [
            Historial_Bulto(
                bulto_id=fh["bulto_id"],
                estado_anterior=fh["estado_anterior"],
                estado_nuevo=fh["estado_nuevo"],
                fecha_hora=datetime.fromisoformat(fh["fecha_hora"]),
                observacion=fh["observacion"],
            )
            for fh in cur_h.fetchall()
        ]

        return Bulto(
            id=bulto_id,
            orden_id=orden_id,
            estado=estado,
            precinto=precinto,
            detalles=detalles,
            historial=historial,
        )
