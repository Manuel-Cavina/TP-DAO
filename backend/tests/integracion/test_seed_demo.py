"""El seed de demostración carga por los casos de uso, es idempotente y alimenta los cinco reportes."""

from datetime import date, timedelta
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi.testclient import TestClient

from bootstrap.application_factory import Application_Factory
from bootstrap.seed_demo import cargar_datos_demo
from config.database.database_engine_singleton import Database_Engine_Singleton


class TestSeedDemo(unittest.TestCase):
    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.url = f"sqlite:///{(Path(self._temp_dir.name) / 'seed.sqlite3').as_posix()}"

    def tearDown(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def test_carga_una_vez_y_alimenta_todos_los_reportes(self) -> None:
        self.assertTrue(cargar_datos_demo(self.url))
        self.assertFalse(cargar_datos_demo(self.url), "La segunda corrida no debe cargar nada")

        client = TestClient(Application_Factory.crear_aplicacion(self.url))
        periodo = {"desde": (date.today() - timedelta(days=100)).isoformat(), "hasta": date.today().isoformat()}

        self.assertEqual(len(client.get("/api/ubicaciones", params={"tipo": "LOCAL"}).json()), 3)
        self.assertEqual(len(client.get("/api/catalogo/productos").json()), 10)

        ventas = client.get("/api/reportes/ventas", params=periodo).json()
        self.assertEqual({f["medio_pago"] for f in ventas["filas"]}, {"EFECTIVO", "TARJETA", "TRANSFERENCIA"})
        self.assertEqual(ventas["totales"]["total_devoluciones"], "1900.00")

        productos = client.get("/api/reportes/productos-mas-vendidos", params=periodo).json()
        self.assertGreaterEqual(productos["totales"]["productos_con_perdida"], 1)

        self.assertGreater(len(client.get("/api/reportes/existencias").json()["filas"]), 0)
        self.assertEqual(client.get("/api/reportes/mermas", params=periodo).json()["totales"]["bultos_rechazados"], 1)
        self.assertEqual(client.get("/api/reportes/tiempos-transito", params=periodo).json()["totales"]["bultos_recibidos"], 9)

        # Las ventas dispararon el Observer: alerta y necesidad de reposición del local
        self.assertEqual(len(client.get("/api/stock/alertas").json()), 1)
        self.assertEqual(len(client.get("/api/logistica/necesidades").json()), 1)


if __name__ == "__main__":
    unittest.main()
