"""Base de pruebas con SQLite en memoria y la sesión publicada en Request_Session_Context."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from config.database.base import Base
from config.database.legacy_schema_initializer import inicializar_esquema_heredado
from config.database.model_registry import cargar_modelos
from config.database.request_session_context import Request_Session_Context

LOCAL_ID = 2
OTRO_LOCAL_ID = 3
CD_ID = 1


class Sqlite_Test_Case(unittest.TestCase):
    """Crea el esquema ORM y el heredado (productos, ubicaciones, stocks) por test."""

    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
        cargar_modelos()
        Base.metadata.create_all(self.engine)
        inicializar_esquema_heredado(self.engine)
        self.session = Session(self.engine)
        self._token = Request_Session_Context.establecer_sesion(self.session)

    def tearDown(self) -> None:
        Request_Session_Context.restablecer(self._token)
        self.session.close()
        self.engine.dispose()

    def cargar_catalogo_y_stock(self, stock: dict[tuple[int, int], int]) -> None:
        """Datos mínimos de Integrante 1: un CD, dos locales, productos 1..3 y el stock pedido."""
        self.session.execute(
            text(
                "INSERT INTO ubicaciones (id, tipo, nombre, direccion, activo) VALUES "
                "(1, 'CD', 'CD Central', 'Ruta 9', 1), "
                "(2, 'LOCAL', 'Local Centro', 'San Martín 100', 1), "
                "(3, 'LOCAL', 'Local Norte', 'Rivadavia 200', 1)"
            )
        )
        self.session.execute(text("INSERT INTO categorias (id, nombre) VALUES (1, 'Bebidas')"))
        self.session.execute(
            text(
                "INSERT INTO proveedores (id, cuit, razon_social, telefono, email) "
                "VALUES (1, '20123456789', 'Prov SA', '111', 'p@p.com')"
            )
        )
        self.session.execute(
            text(
                "INSERT INTO productos (id, codigo, nombre, precio_venta, costo_unitario, "
                "categoria_id, proveedor_id, activo) VALUES "
                "(1, 'P1', 'Agua', 100.0, 50.0, 1, 1, 1), "
                "(2, 'P2', 'Gaseosa', 250.5, 120.0, 1, 1, 1), "
                "(3, 'P3', 'Jugo discontinuado', 80.0, 40.0, 1, 1, 0)"
            )
        )
        for (producto_id, ubicacion_id), cantidad in stock.items():
            self.session.execute(
                text(
                    "INSERT INTO stocks (producto_id, ubicacion_id, cantidad_disponible) "
                    "VALUES (:p, :u, :c)"
                ),
                {"p": producto_id, "u": ubicacion_id, "c": cantidad},
            )
        self.session.flush()

    def disponible(self, producto_id: int, ubicacion_id: int) -> int:
        return self.session.execute(
            text("SELECT cantidad_disponible FROM stocks WHERE producto_id = :p AND ubicacion_id = :u"),
            {"p": producto_id, "u": ubicacion_id},
        ).scalar_one()
