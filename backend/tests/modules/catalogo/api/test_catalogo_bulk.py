"""Pruebas de actualización masiva atómica del catálogo y stock (T023, T025)."""

from decimal import Decimal
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from fastapi.testclient import TestClient

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from modules.seguridad.application import Auth_Service


class Test_Catalogo_Bulk(unittest.TestCase):
    """Verifica reglas de negocio y transaccionalidad atómica en actualización masiva."""

    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "catalogo_bulk.sqlite3"
        self.app = Application_Factory.crear_aplicacion(
            database_url=f"sqlite:///{self.db_path.as_posix()}"
        )
        self.client = TestClient(self.app)
        self._autenticar_admin_demo()

        self.cd = self._post("/api/ubicaciones/centros-distribucion", {"nombre": "CD Central", "direccion": "Ruta 9"})
        self.local = self._post("/api/ubicaciones/locales", {"nombre": "Local 1", "direccion": "Av. San Martín 100"})
        self.categoria = self._post("/api/catalogo/categorias", {"nombre": "General"})
        self.proveedor = self._post(
            "/api/catalogo/proveedores",
            {"cuit": "20123456789", "razon_social": "Proveedor Principal", "telefono": "11445566", "email": "p@test.com"},
        )

    def tearDown(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def _post(self, url: str, body: dict | list, estado: int = 201) -> dict:
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

        resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@stocky.local", "password": "stocky-demo"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)

    def _crear_producto(
        self,
        codigo: str,
        nombre: str,
        precio_venta: str = "100.00",
        costo_unitario: str = "60.00",
        categoria_id: int | None = None,
        proveedor_id: int | None = None,
        nivel_minimo: int = 5,
    ) -> dict:
        body = {
            "codigo": codigo,
            "nombre": nombre,
            "precio_venta": precio_venta,
            "costo_unitario": costo_unitario,
            "categoria_id": categoria_id or self.categoria["id"],
            "proveedor_id": proveedor_id or self.proveedor["id"],
            "nivel_minimo_existencia": nivel_minimo,
        }
        return self._post("/api/catalogo/productos", body, estado=201)

    def test_actualizacion_masiva_exitosa_50_productos(self) -> None:
        """Verifica actualización masiva exitosa con 50 productos."""
        productos_creados = []
        for i in range(1, 51):
            prod = self._crear_producto(
                codigo=f"PROD-{i:03d}",
                nombre=f"Producto {i:03d}",
                precio_venta="100.00",
                costo_unitario="50.00",
                nivel_minimo=10,
            )
            productos_creados.append(prod)

        # Ajuste porcentual de +25% en precio de venta (100 -> 125) para los 50 productos
        actualizaciones = [
            {
                "codigo": prod["codigo"],
                "precio_venta": "125.00",
            }
            for prod in productos_creados
        ]

        resp = self.client.post(
            "/api/catalogo/productos/actualizacion-masiva",
            json={"actualizaciones": actualizaciones},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(data["actualizados"], 50)
        self.assertEqual(len(data["productos"]), 50)

        # Verificar que todos los 50 productos reflejan el nuevo precio en catálogo
        listar_resp = self.client.get("/api/catalogo/productos")
        self.assertEqual(listar_resp.status_code, 200)
        productos_actuales = {p["codigo"]: p for p in listar_resp.json()}
        for i in range(1, 51):
            codigo = f"PROD-{i:03d}"
            self.assertIn(codigo, productos_actuales)
            self.assertEqual(Decimal(str(productos_actuales[codigo]["precio_venta"])), Decimal("125.00"))

    def test_rollback_atomico_si_producto_es_invalido_o_inexistente(self) -> None:
        """Verifica que si un producto de la lista es inválido o inexistente, nada se aplica."""
        p1 = self._crear_producto("RB-01", "Prod 1", precio_venta="100.00")
        p2 = self._crear_producto("RB-02", "Prod 2", precio_venta="100.00")

        # Caso A: Uno de los productos no existe
        payload_inexistente = {
            "actualizaciones": [
                {"codigo": "RB-01", "precio_venta": "150.00"},
                {"codigo": "PROD-FANTASMA-999", "precio_venta": "200.00"},
            ]
        }
        resp_404 = self.client.post("/api/catalogo/productos/actualizacion-masiva", json=payload_inexistente)
        self.assertEqual(resp_404.status_code, 404)

        # Verificar que RB-01 no cambió su precio
        prod1_actual = self.client.get(f"/api/catalogo/productos/{p1['id']}").json()
        self.assertEqual(Decimal(str(prod1_actual["precio_venta"])), Decimal("100.00"))

        # Caso B: Uno de los productos tiene precio inválido (<= 0)
        payload_invalido = {
            "actualizaciones": [
                {"codigo": "RB-01", "precio_venta": "150.00"},
                {"codigo": "RB-02", "precio_venta": "-10.00"},
            ]
        }
        resp_400 = self.client.post("/api/catalogo/productos/actualizacion-masiva", json=payload_invalido)
        self.assertEqual(resp_400.status_code, 400)

        # Verificar que ni RB-01 ni RB-02 cambiaron
        prod1_actual = self.client.get(f"/api/catalogo/productos/{p1['id']}").json()
        prod2_actual = self.client.get(f"/api/catalogo/productos/{p2['id']}").json()
        self.assertEqual(Decimal(str(prod1_actual["precio_venta"])), Decimal("100.00"))
        self.assertEqual(Decimal(str(prod2_actual["precio_venta"])), Decimal("100.00"))

    def test_rollback_si_categoria_o_proveedor_inactivos(self) -> None:
        """Verifica que no se permite vincular categorías o proveedores inactivos en lote."""
        cat_inactiva = self._post("/api/catalogo/categorias", {"nombre": "Cat Temporal"})
        prov_inactivo = self._post(
            "/api/catalogo/proveedores",
            {"cuit": "20999999994", "razon_social": "Prov Temporal", "telefono": "123", "email": "t@t.com"},
        )
        p1 = self._crear_producto("INAC-01", "Prod Activo 1", precio_venta="100.00")
        p2 = self._crear_producto("INAC-02", "Prod Activo 2", precio_venta="100.00")

        # Desactivar categoría y proveedor
        del_cat = self.client.delete(f"/api/catalogo/categorias/{cat_inactiva['id']}")
        self.assertEqual(del_cat.status_code, 204)
        del_prov = self.client.delete(f"/api/catalogo/proveedores/{prov_inactivo['id']}")
        self.assertEqual(del_prov.status_code, 204)

        # Intento 1: Asignar categoría inactiva a INAC-01
        payload_cat = {
            "actualizaciones": [
                {"codigo": "INAC-01", "categoria_id": cat_inactiva["id"], "precio_venta": "199.00"},
            ]
        }
        resp_cat = self.client.post("/api/catalogo/productos/actualizacion-masiva", json=payload_cat)
        self.assertEqual(resp_cat.status_code, 404)

        # Verificar que INAC-01 conservó su precio y categoría previa
        prod1 = self.client.get(f"/api/catalogo/productos/{p1['id']}").json()
        self.assertEqual(Decimal(str(prod1["precio_venta"])), Decimal("100.00"))
        self.assertEqual(prod1["categoria_id"], self.categoria["id"])

        # Intento 2: Asignar proveedor inactivo a INAC-02
        payload_prov = {
            "actualizaciones": [
                {"codigo": "INAC-02", "proveedor_id": prov_inactivo["id"], "precio_venta": "199.00"},
            ]
        }
        resp_prov = self.client.post("/api/catalogo/productos/actualizacion-masiva", json=payload_prov)
        self.assertEqual(resp_prov.status_code, 404)

        # Verificar que INAC-02 conservó su estado previo
        prod2 = self.client.get(f"/api/catalogo/productos/{p2['id']}").json()
        self.assertEqual(Decimal(str(prod2["precio_venta"])), Decimal("100.00"))
        self.assertEqual(prod2["proveedor_id"], self.proveedor["id"])

    def test_actualizacion_conjunta_precio_y_nivel_minimo_stock(self) -> None:
        """Verifica actualización simultánea de precio y nivel mínimo de existencia en todas las ubicaciones."""
        prod = self._crear_producto("CONJUNTO-01", "Harina 1kg", precio_venta="100.00", nivel_minimo=5)

        # Comprobar niveles iniciales en stocks
        stocks_antes = self.client.get(f"/api/stock?producto_id={prod['id']}").json()
        self.assertGreater(len(stocks_antes), 0)
        for st in stocks_antes:
            self.assertEqual(st["nivel_minimo_existencia"], 5)

        # Actualizar en bloque precio a 180.00 y nivel mínimo a 25
        payload = {
            "actualizaciones": [
                {
                    "codigo": "CONJUNTO-01",
                    "precio_venta": "180.00",
                    "nivel_minimo": 25,
                }
            ]
        }
        resp = self.client.post("/api/catalogo/productos/actualizacion-masiva", json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)

        # Verificar nuevo precio de venta
        prod_actual = self.client.get(f"/api/catalogo/productos/{prod['id']}").json()
        self.assertEqual(Decimal(str(prod_actual["precio_venta"])), Decimal("180.00"))

        # Verificar que todas las ubicaciones tienen el nuevo nivel mínimo
        stocks_despues = self.client.get(f"/api/stock?producto_id={prod['id']}").json()
        self.assertEqual(len(stocks_despues), len(stocks_antes))
        for st in stocks_despues:
            self.assertEqual(st["nivel_minimo_existencia"], 25)

    def test_entradas_sanitizadas_y_payload_flexible(self) -> None:
        """Verifica que espacios superfluos en código se limpian y que se soportan listas directas."""
        prod = self._crear_producto("CLEAN-01", "Yerba Mate", precio_venta="500.00", nivel_minimo=10)

        # Enviar código con espacios y payload como lista directa
        payload_lista = [
            {"codigo": "   CLEAN-01   ", "precio_venta": "550.00", "nivel_minimo_existencia": 12}
        ]
        resp = self.client.post("/api/catalogo/productos/actualizacion-masiva", json=payload_lista)
        self.assertEqual(resp.status_code, 200, resp.text)

        prod_actual = self.client.get(f"/api/catalogo/productos/{prod['id']}").json()
        self.assertEqual(Decimal(str(prod_actual["precio_venta"])), Decimal("550.00"))

        stocks = self.client.get(f"/api/stock?producto_id={prod['id']}").json()
        for st in stocks:
            self.assertEqual(st["nivel_minimo_existencia"], 12)


if __name__ == "__main__":
    unittest.main()
