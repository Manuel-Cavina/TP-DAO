import sqlite3

from modules.logistica.domain.precinto import Precinto


class Precinto_Repository:
    """Repositorio SQLite para la persistencia y consulta de precintos."""

    def guardar(
        self, connection: sqlite3.Connection, precinto: Precinto, utilizado: bool = False
    ) -> None:
        """Inserta un precinto en la base de datos."""
        query = """
        INSERT INTO precintos (codigo, esta_intacto, utilizado)
        VALUES (?, ?, ?)
        """
        connection.execute(
            query,
            (precinto.codigo, 1 if precinto.esta_intacto else 0, 1 if utilizado else 0),
        )

    def obtener_por_codigo(
        self, connection: sqlite3.Connection, codigo: str
    ) -> Precinto | None:
        """Obtiene un precinto por su codigo unico."""
        query = "SELECT codigo, esta_intacto FROM precintos WHERE codigo = ?"
        cursor = connection.execute(query, (codigo.strip(),))
        row = cursor.fetchone()
        if row is None:
            return None
        return Precinto(codigo=row["codigo"], esta_intacto=bool(row["esta_intacto"]))

    def esta_disponible(self, connection: sqlite3.Connection, codigo: str) -> bool:
        """Indica si un precinto existe, esta intacto y no fue utilizado aun."""
        query = "SELECT esta_intacto, utilizado FROM precintos WHERE codigo = ?"
        cursor = connection.execute(query, (codigo.strip(),))
        row = cursor.fetchone()
        if row is None:
            return False
        return bool(row["esta_intacto"]) and not bool(row["utilizado"])

    def marcar_utilizado(self, connection: sqlite3.Connection, codigo: str) -> None:
        """Marca un precinto como ya utilizado en un bulto."""
        query = "UPDATE precintos SET utilizado = 1 WHERE codigo = ?"
        connection.execute(query, (codigo.strip(),))

    def actualizar(self, connection: sqlite3.Connection, precinto: Precinto) -> None:
        """Actualiza el estado de integridad de un precinto."""
        query = "UPDATE precintos SET esta_intacto = ? WHERE codigo = ?"
        connection.execute(query, (1 if precinto.esta_intacto else 0, precinto.codigo))
