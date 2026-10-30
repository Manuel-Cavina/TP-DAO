"""FR-003: reversible location availability preserves stock and historical identity."""

from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "src"))

from fastapi.testclient import TestClient

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from modules.seguridad.application import Auth_Service
from modules.ubicaciones_stock.domain import Centro_Distribucion, Local


class Test_Ubicacion_Domain_Lifecycle(unittest.TestCase):
    def test_cd_and_local_toggle_without_changing_identity(self) -> None:
        for location_type in (Centro_Distribucion, Local):
            with self.subTest(location_type=location_type):
                location = location_type("Location", "Address", "123", id=7)
                location.desactivar()
                location.desactivar()
                self.assertFalse(location.activo)
                location.reactivar()
                location.reactivar()
                self.assertTrue(location.activo)
                self.assertEqual((location.id, location.nombre, location.telefono), (7, "Location", "123"))


class Test_Ubicacion_Lifecycle_API(unittest.TestCase):
    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self.temp_dir = tempfile.TemporaryDirectory()
        path = Path(self.temp_dir.name) / "location_lifecycle.sqlite3"
        self.app = Application_Factory.crear_aplicacion(database_url=f"sqlite:///{path.as_posix()}")
        self.client = TestClient(self.app)
        session = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        token = Request_Session_Context.establecer_sesion(session)
        try:
            Auth_Service().sembrar_identidades_defecto()
            session.commit()
        finally:
            Request_Session_Context.restablecer(token)
            session.close()
        login = self.client.post("/api/seguridad/login", json={"login": "admin@stocky.local", "password": "stocky-demo"})
        self.assertEqual(login.status_code, 200, login.text)
        self.csrf = {"X-CSRF-Token": login.json()["csrf_token"]}
        self.cd = self._post("/api/ubicaciones/centros-distribucion", {"nombre": "CD", "direccion": "Route 1"})
        self.local = self._post("/api/ubicaciones/locales", {"nombre": "Branch", "direccion": "Street 1"})

    def tearDown(self) -> None:
        self.client.close()
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self.temp_dir.cleanup()

    def _post(self, url: str, body: dict, status: int = 201) -> dict:
        response = self.client.post(url, json=body, headers=self.csrf)
        self.assertEqual(response.status_code, status, response.text)
        return response.json()

    def test_cd_and_branch_reactivation_are_idempotent_and_preserve_records(self) -> None:
        for location in (self.cd, self.local):
            with self.subTest(location_type=location["tipo"]):
                url = f"/api/ubicaciones/{location['id']}"
                self.assertEqual(self.client.delete(url).status_code, 204)
                self.assertEqual(self.client.delete(url).status_code, 204)
                self.assertFalse(self.client.get(url).json()["activo"])
                active_ids = {item["id"] for item in self.client.get("/api/ubicaciones?solo_activas=true").json()}
                self.assertNotIn(location["id"], active_ids)
                for _ in range(2):
                    restored = self._post(f"{url}/reactivar", {}, 200)
                    self.assertEqual(restored, location)
                self.assertEqual(self.client.get(url).json(), location)
        self.assertEqual(len(self.client.get("/api/ubicaciones").json()), 2)

    def test_missing_location_returns_404(self) -> None:
        response = self.client.post("/api/ubicaciones/9999/reactivar", json={}, headers=self.csrf)
        self.assertEqual(response.status_code, 404)

    def test_reactivation_requires_valid_csrf(self) -> None:
        url = f"/api/ubicaciones/{self.cd['id']}/reactivar"
        for headers in ({}, {"X-CSRF-Token": "incorrect"}):
            with self.subTest(headers=headers):
                response = self.client.post(url, json={}, headers=headers)
                self.assertEqual(response.status_code, 403, response.text)

    def test_operator_and_anonymous_cannot_change_availability(self) -> None:
        with TestClient(self.app) as anonymous:
            url = f"/api/ubicaciones/{self.cd['id']}"
            self.assertEqual(anonymous.post(f"{url}/reactivar", json={}).status_code, 401)
            self.assertEqual(anonymous.delete(url).status_code, 401)
        with TestClient(self.app) as operator:
            login = operator.post("/api/seguridad/login", json={"login": "operador@stocky.local", "password": "stocky-demo"})
            self.assertEqual(login.status_code, 200, login.text)
            csrf = {"X-CSRF-Token": login.json()["csrf_token"]}
            self.assertEqual(operator.post(f"{url}/reactivar", json={}, headers=csrf).status_code, 403)
            self.assertEqual(operator.delete(url, headers=csrf).status_code, 403)
        self.assertTrue(self.client.get(url).json()["activo"])

    def test_stock_and_order_history_survive_deactivation_and_reactivation(self) -> None:
        category = self._post("/api/catalogo/categorias", {"nombre": "Category"})
        provider = self._post("/api/catalogo/proveedores", {"cuit": "20123456789", "razon_social": "Provider", "telefono": "123", "email": "provider@test.local"})
        product = self._post("/api/catalogo/productos", {"codigo": "HISTORY", "nombre": "Product", "precio_venta": "10", "costo_unitario": "5", "categoria_id": category["id"], "proveedor_id": provider["id"], "nivel_minimo_existencia": 1})
        self._post("/api/stock/ingresos", {"producto_id": product["id"], "cd_id": self.cd["id"], "cantidad": 20})
        order_body = {"origen_id": self.cd["id"], "destino_id": self.local["id"], "items": [{"producto_id": product["id"], "cantidad": 2}]}
        order = self._post("/api/logistica/ordenes", order_body)
        stock_url = f"/api/stock/{product['id']}/{self.cd['id']}"
        stock_before = self.client.get(stock_url).json()
        for location in (self.cd, self.local):
            url = f"/api/ubicaciones/{location['id']}"
            self.assertEqual(self.client.delete(url).status_code, 204)
            rejected = self.client.post("/api/logistica/ordenes", json=order_body, headers=self.csrf)
            self.assertEqual(rejected.status_code, 404, rejected.text)
            if location["tipo"] == "CD":
                ingress = self.client.post("/api/stock/ingresos", json={"producto_id": product["id"], "cd_id": location["id"], "cantidad": 1})
                self.assertEqual(ingress.status_code, 404, ingress.text)
            historical = self.client.get(f"/api/logistica/ordenes/{order['id']}")
            self.assertEqual(historical.status_code, 200)
            self.assertEqual(historical.json(), order)
            self.assertEqual(self.client.get(stock_url).json(), stock_before)
            self._post(f"{url}/reactivar", {}, 200)
            self.assertEqual(self.client.get(stock_url).json(), stock_before)

