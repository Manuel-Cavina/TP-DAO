"""Catálogo, stock y ubicaciones: lectura con sesión iniciada, escritura solo para el Administrador."""

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

LECTURAS = ["/api/catalogo/categorias", "/api/catalogo/proveedores", "/api/catalogo/productos",
            "/api/stock", "/api/stock/alertas", "/api/ubicaciones"]
ESCRITURAS = [
    ("post", "/api/catalogo/categorias", {"nombre": "Nueva"}),
    ("post", "/api/catalogo/proveedores", {"cuit": "20999999999", "razon_social": "P", "telefono": "1", "email": "p@test.local"}),
    ("put", "/api/catalogo/categorias/1", {"nombre": "Renombrada"}),
    ("delete", "/api/catalogo/categorias/1", None),
    ("post", "/api/stock/ingresos", {"producto_id": 1, "cd_id": 1, "cantidad": 5}),
    ("put", "/api/stock/1/1/nivel-minimo", {"nivel_minimo_existencia": 3}),
    ("post", "/api/ubicaciones/locales", {"nombre": "Local X", "direccion": "Calle 1"}),
    ("put", "/api/ubicaciones/1", {"nombre": "CD", "direccion": "Ruta 9"}),
]


class Test_Permisos_Catalogo_Stock_Ubicaciones(unittest.TestCase):
    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self.temp_dir = tempfile.TemporaryDirectory()
        path = Path(self.temp_dir.name) / "permisos.sqlite3"
        self.app = Application_Factory.crear_aplicacion(database_url=f"sqlite:///{path.as_posix()}")
        session = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        token = Request_Session_Context.establecer_sesion(session)
        try:
            Auth_Service().sembrar_identidades_defecto()
            session.commit()
        finally:
            Request_Session_Context.restablecer(token)
            session.close()

    def tearDown(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self.temp_dir.cleanup()

    def _login(self, client: TestClient, usuario: str) -> dict:
        r = client.post("/api/seguridad/login", json={"login": usuario, "password": "stocky-demo"})
        self.assertEqual(r.status_code, 200, r.text)
        return {"X-CSRF-Token": r.json()["csrf_token"]}

    def test_sin_sesion_no_puede_leer_ni_escribir(self) -> None:
        with TestClient(self.app) as anonimo:
            for url in LECTURAS:
                with self.subTest(url=url):
                    self.assertEqual(anonimo.get(url).status_code, 401)
            for metodo, url, body in ESCRITURAS:
                with self.subTest(metodo=metodo, url=url):
                    kwargs = {"json": body} if body is not None else {}
                    self.assertEqual(anonimo.request(metodo.upper(), url, **kwargs).status_code, 401)

    def test_operador_puede_leer_pero_no_modificar(self) -> None:
        with TestClient(self.app) as operador:
            csrf = self._login(operador, "operador@stocky.local")
            for url in LECTURAS:
                with self.subTest(url=url):
                    self.assertEqual(operador.get(url).status_code, 200)
            for metodo, url, body in ESCRITURAS:
                with self.subTest(metodo=metodo, url=url):
                    kwargs = {"json": body} if body is not None else {}
                    self.assertEqual(operador.request(metodo.upper(), url, headers=csrf, **kwargs).status_code, 403)

    def test_operador_puede_marcar_alertas_como_leidas(self) -> None:
        with TestClient(self.app) as operador:
            csrf = self._login(operador, "operador@stocky.local")
            # La alerta no existe: el permiso pasa y responde el dominio (404), no la seguridad (401/403).
            self.assertEqual(operador.post("/api/stock/alertas/999/leer", json={}, headers=csrf).status_code, 404)

    def test_administrador_puede_escribir(self) -> None:
        with TestClient(self.app) as admin:
            csrf = self._login(admin, "admin@stocky.local")
            r = admin.post("/api/catalogo/categorias", json={"nombre": "Bebidas"}, headers=csrf)
            self.assertEqual(r.status_code, 201, r.text)
            r = admin.post("/api/ubicaciones/locales", json={"nombre": "Local Centro", "direccion": "Calle 1"}, headers=csrf)
            self.assertEqual(r.status_code, 201, r.text)


if __name__ == "__main__":
    unittest.main()
