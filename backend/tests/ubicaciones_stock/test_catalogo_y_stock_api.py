"""API HTTP de catálogo, ubicaciones y stock: códigos de respuesta y reglas de Integrante 1."""

from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi.testclient import TestClient

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from modules.seguridad.application import Auth_Service


class TestCatalogoYStockAPI(unittest.TestCase):
    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "catalogo_stock.sqlite3"
        self.client = TestClient(Application_Factory.crear_aplicacion(database_url=f"sqlite:///{self.db_path.as_posix()}"))
        self._autenticar_admin_demo()

        self.cd = self._post("/api/ubicaciones/centros-distribucion", {"nombre": "CD", "direccion": "Ruta 9"})
        self.local = self._post("/api/ubicaciones/locales", {"nombre": "Centro", "direccion": "San Martín 1"})
        categoria = self._post("/api/catalogo/categorias", {"nombre": "Bebidas"})
        proveedor = self._post(
            "/api/catalogo/proveedores",
            {"cuit": "20123456789", "razon_social": "Prov SA", "telefono": "111", "email": "p@prov.com"},
        )
        self.producto_body = {
            "codigo": "AGUA", "nombre": "Agua", "precio_venta": "100.00", "costo_unitario": "60.00",
            "categoria_id": categoria["id"], "proveedor_id": proveedor["id"], "nivel_minimo_existencia": 5,
        }
        self.producto = self._post("/api/catalogo/productos", self.producto_body)

    def tearDown(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def _post(self, url: str, body: dict, estado: int = 201) -> dict:
        res = self.client.post(url, json=body)
        self.assertEqual(res.status_code, estado, res.text)
        return res.json()

    def _autenticar_admin_demo(self) -> None:
        sesion = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        token = Request_Session_Context.establecer_sesion(sesion)
        try:
            Auth_Service().sembrar_identidades_defecto()
            sesion.commit()
        finally:
            Request_Session_Context.restablecer(token)
            sesion.close()

        respuesta = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@stocky.local", "password": "stocky-demo"},
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.text)

    def test_codigos_http(self) -> None:
        p = self.producto["id"]
        casos = [
            ("POST", "/api/catalogo/productos", self.producto_body, 409),
            ("POST", "/api/catalogo/categorias", {"nombre": "Bebidas"}, 409),
            ("POST", "/api/catalogo/proveedores", {"cuit": "20-12345678-9", "razon_social": "X", "telefono": "1", "email": "x@x.com"}, 409),
            ("POST", "/api/catalogo/proveedores", {"cuit": "2012345678X", "razon_social": "X", "telefono": "1", "email": "x@x.com"}, 400),
            ("POST", "/api/catalogo/productos", {**self.producto_body, "codigo": "OTRO", "precio_venta": "0"}, 400),
            ("POST", "/api/catalogo/productos", {**self.producto_body, "codigo": "OTRO", "categoria_id": 999}, 404),
            ("GET", "/api/catalogo/productos/999", None, 404),
            ("DELETE", f"/api/ubicaciones/{self.cd['id']}", None, 400),
            ("GET", "/api/ubicaciones/999", None, 404),
            ("POST", "/api/stock/ingresos", {"producto_id": p, "cd_id": self.local["id"], "cantidad": 5}, 400),
            ("POST", "/api/stock/ingresos", {"producto_id": p, "cd_id": 999, "cantidad": 5}, 404),
            ("POST", "/api/stock/ingresos", {"producto_id": p, "cd_id": self.cd["id"], "cantidad": 0}, 400),
            ("GET", f"/api/stock/{p}/999", None, 404),
            ("POST", "/api/stock/alertas/999/leer", None, 404),
        ]
        for metodo, url, body, estado in casos:
            with self.subTest(metodo=metodo, url=url, body=body):
                res = self.client.request(metodo, url, json=body)
                self.assertEqual(res.status_code, estado, res.text)

    def test_alta_de_producto_y_de_local_crean_stock(self) -> None:
        stocks = self.client.get("/api/stock", params={"producto_id": self.producto["id"]}).json()
        self.assertEqual(len(stocks), 2)

        nuevo_local = self._post("/api/ubicaciones/locales", {"nombre": "Norte", "direccion": "Rivadavia 2"})
        stock = self.client.get(f"/api/stock/{self.producto['id']}/{nuevo_local['id']}").json()
        self.assertEqual((stock["cantidad_disponible"], stock["en_o_bajo_minimo"]), (0, True))

    def test_filtra_stock_por_producto_y_por_ubicacion(self) -> None:
        """Regresión: producto_id se ignoraba porque compartía el mismo Query(...) que ubicacion_id."""
        otro = self._post("/api/catalogo/productos", {**self.producto_body, "codigo": "GAS"})

        por_producto = self.client.get("/api/stock", params={"producto_id": otro["id"]}).json()
        por_ambos = self.client.get("/api/stock", params={"producto_id": otro["id"], "ubicacion_id": self.cd["id"]}).json()

        self.assertEqual({s["producto_id"] for s in por_producto}, {otro["id"]})
        self.assertEqual(len(por_producto), 2)
        self.assertEqual([(s["producto_id"], s["ubicacion_id"]) for s in por_ambos], [(otro["id"], self.cd["id"])])

    def test_subir_el_minimo_dispara_alerta_y_se_marca_leida(self) -> None:
        p, cd = self.producto["id"], self.cd["id"]
        self._post("/api/stock/ingresos", {"producto_id": p, "cd_id": cd, "cantidad": 8})
        self.assertEqual(self.client.get("/api/stock/alertas").json(), [])

        res = self.client.put(f"/api/stock/{p}/{cd}/nivel-minimo", json={"nivel_minimo_existencia": 10})
        self.assertEqual(res.status_code, 200, res.text)

        alertas = self.client.get("/api/stock/alertas", params={"leida": False}).json()
        self.assertEqual([(a["ubicacion_id"], a["cantidad_disponible"], a["nivel_minimo"]) for a in alertas], [(cd, 8, 10)])
        self.assertTrue(self.client.post(f"/api/stock/alertas/{alertas[0]['id']}/leer").json()["leida"])
        self.assertEqual(len(self.client.get("/api/stock", params={"solo_bajo_minimo": True, "ubicacion_id": cd}).json()), 1)

    def test_baja_logica_de_producto_impide_venderlo(self) -> None:
        res = self.client.delete(f"/api/catalogo/productos/{self.producto['id']}")
        self.assertEqual((res.status_code, res.content), (204, b""))
        self.assertFalse(self.client.get(f"/api/catalogo/productos/{self.producto['id']}").json()["activo"])

        venta = self.client.post(
            "/api/ventas",
            json={
                "local_id": self.local["id"],
                "items": [{"producto_id": self.producto["id"], "cantidad": 1}],
                "pago": {"medio": "EFECTIVO", "monto_recibido": "100"},
            },
        )
        self.assertEqual(venta.status_code, 404)

    def test_la_base_admite_varios_cd_y_cuit_no_numerico(self) -> None:
        with sqlite3.connect(self.db_path) as conexion:
            conexion.execute("INSERT INTO ubicaciones (tipo, nombre, direccion) VALUES ('CD', 'Otro', 'X')")
            with self.assertRaises(sqlite3.IntegrityError):
                conexion.execute("INSERT INTO proveedores (cuit, razon_social, telefono, email) VALUES ('2012345678X', 'X', '1', 'x@x.com')")

    def test_busqueda_por_q_en_endpoints_api(self) -> None:
        cat_res = self.client.get("/api/catalogo/categorias", params={"q": "Beb"}).json()
        self.assertEqual([c["nombre"] for c in cat_res], ["Bebidas"])
        self.assertEqual(self.client.get("/api/catalogo/categorias", params={"q": "inexistente"}).json(), [])

        prov_res = self.client.get("/api/catalogo/proveedores", params={"q": "12345"}).json()
        self.assertEqual([p["cuit"] for p in prov_res], ["20123456789"])
        self.assertEqual(self.client.get("/api/catalogo/proveedores", params={"q": "inexistente"}).json(), [])

        prod_res = self.client.get("/api/catalogo/productos", params={"q": "AGUA"}).json()
        self.assertEqual([p["codigo"] for p in prod_res], ["AGUA"])
        self.assertEqual(self.client.get("/api/catalogo/productos", params={"q": "inexistente"}).json(), [])

        ub_res = self.client.get("/api/ubicaciones", params={"q": "Centro"}).json()
        self.assertEqual([u["nombre"] for u in ub_res], ["Centro"])
        self.assertEqual(self.client.get("/api/ubicaciones", params={"q": "inexistente"}).json(), [])


if __name__ == "__main__":
    unittest.main()
