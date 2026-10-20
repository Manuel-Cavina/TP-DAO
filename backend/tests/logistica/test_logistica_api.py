"""Flujo HTTP real CD -> local -> venta: logistica mueve el stock que despues vende ventas_caja.

Cubre P3 a P7 con el stock de schema.sql (sin mocks): V1 (solo se acredita lo verificado),
V2 (trazabilidad) y V3 (no se vende lo que no llego verificado).
"""

from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi.testclient import TestClient

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton

CD_ID = 1
LOCAL_ID = 2
AGUA = 1
GASEOSA = 2
BASE = "/api/logistica"
TRANSFERENCIA = {"medio": "TRANSFERENCIA", "cbu_o_alias": "mi.alias.mp", "codigo_transaccion": "TX-1"}


class TestLogisticaAPI(unittest.TestCase):
    """Pruebas de integracion HTTP mediante Application_Factory y Session Middleware."""

    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "test_api.sqlite3"
        self.app = Application_Factory.crear_aplicacion(database_url=f"sqlite:///{self.db_path.as_posix()}")
        self.client = TestClient(self.app)
        self._cargar_datos_integrante_1()

    def tearDown(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def _cargar_datos_integrante_1(self) -> None:
        with sqlite3.connect(self.db_path) as conexion:
            conexion.executescript(
                """
                INSERT INTO ubicaciones (id, tipo, nombre, direccion) VALUES
                    (1, 'CD', 'CD Central', 'Ruta 9'),
                    (2, 'LOCAL', 'Local Centro', 'San Martín 100');
                INSERT INTO categorias (id, nombre) VALUES (1, 'Bebidas');
                INSERT INTO proveedores (id, cuit, razon_social, telefono, email)
                    VALUES (1, '20123456789', 'Prov SA', '111', 'p@p.com');
                INSERT INTO productos (id, codigo, nombre, precio_venta, costo_unitario, categoria_id, proveedor_id)
                    VALUES (1, 'P1', 'Agua', 100.0, 50.0, 1, 1), (2, 'P2', 'Gaseosa', 250.0, 120.0, 1, 1);
                INSERT INTO stocks (producto_id, ubicacion_id, cantidad_disponible) VALUES (1, 1, 50), (2, 1, 20);
                """
            )

    def _stock(self, producto_id: int, ubicacion_id: int) -> tuple[int, int] | None:
        with sqlite3.connect(self.db_path) as conexion:
            fila = conexion.execute(
                "SELECT cantidad_disponible, cantidad_en_transito FROM stocks "
                "WHERE producto_id = ? AND ubicacion_id = ?",
                (producto_id, ubicacion_id),
            ).fetchone()
        return tuple(fila) if fila is not None else None

    def _post(self, url: str, body: dict | None = None, estado: int = 200) -> dict:
        res = self.client.post(f"{BASE}{url}", json=body)
        self.assertEqual(res.status_code, estado, res.text)
        return res.json()

    def _bulto_precintado(self, orden_id: int, producto_id: int, cantidad: int, precinto: str) -> int:
        bulto = self._post(
            f"/ordenes/{orden_id}/bultos", {"items": [{"producto_id": producto_id, "cantidad": cantidad}]}, 201
        )
        self._post("/precintos", {"codigo": precinto}, 201)
        self._post(f"/bultos/{bulto['id']}/precintar", {"codigo_precinto": precinto})
        return bulto["id"]

    def test_health_check(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_flujo_completo_del_cd_a_la_venta_en_el_local(self) -> None:
        # P3: necesidades del local consolidadas en una orden CD -> local
        self._post("/necesidades", {"producto_id": AGUA, "local_id": LOCAL_ID, "cantidad": 10}, 201)
        self._post("/necesidades", {"producto_id": GASEOSA, "local_id": LOCAL_ID, "cantidad": 4}, 201)
        self.assertEqual(len(self.client.get(f"{BASE}/necesidades", params={"local_id": LOCAL_ID}).json()), 2)
        orden = self._post("/ordenes/consolidar", {"local_destino_id": LOCAL_ID, "origen_id": CD_ID}, 201)

        # Antes de que llegue la mercaderia, el local no puede vender (V3)
        venta_prematura = self.client.post(
            "/api/ventas",
            json={"local_id": LOCAL_ID, "items": [{"producto_id": AGUA, "cantidad": 1}], "pago": TRANSFERENCIA},
        )
        self.assertEqual(venta_prematura.status_code, 400)

        # P4: empaquetar descuenta el stock disponible del CD
        bulto_agua = self._bulto_precintado(orden["id"], AGUA, 10, "SEAL-AGUA")
        bulto_gaseosa = self._bulto_precintado(orden["id"], GASEOSA, 4, "SEAL-GAS")
        self.assertEqual(self._stock(AGUA, CD_ID), (40, 0))
        self.assertEqual(self._stock(GASEOSA, CD_ID), (16, 0))
        remito = self.client.post(
            f"{BASE}/remitos",
            params={"orden_id": orden["id"]},
            json={"numero": "REM-2026-01", "bultos_ids": [bulto_agua, bulto_gaseosa]},
        )
        self.assertEqual(remito.status_code, 201, remito.text)

        # P5: despacho -> mercaderia en transito hacia el local, todavia no vendible
        self.assertEqual(self._post("/remitos/REM-2026-01/despachar")["estado"], "DESPACHADO")
        self.assertEqual(self._stock(AGUA, LOCAL_ID), (0, 10))
        self.assertEqual(self._stock(GASEOSA, LOCAL_ID), (0, 4))

        # P6: recepcion y verificacion: agua intacta, gaseosa con precinto violado
        self._post("/remitos/REM-2026-01/recibir")
        verificado = self._post(
            f"/bultos/{bulto_agua}/verificar", {"codigo_precinto_recibido": "SEAL-AGUA", "esta_intacto": True}
        )
        rechazado = self._post(
            f"/bultos/{bulto_gaseosa}/verificar", {"codigo_precinto_recibido": "SEAL-GAS", "esta_intacto": False}
        )
        self.assertEqual((verificado["estado"], rechazado["estado"]), ("VERIFICADO", "RECHAZADO"))
        self.assertFalse(rechazado["precinto"]["esta_intacto"])

        # V1: al cerrar, lo verificado pasa a disponible y lo rechazado es merma
        cierre = self._post("/remitos/REM-2026-01/cerrar")
        self.assertEqual((cierre["unidades_acreditadas"], cierre["unidades_merma"]), (10, 4))
        self.assertEqual(self._stock(AGUA, LOCAL_ID), (10, 0))
        self.assertEqual(self._stock(GASEOSA, LOCAL_ID), (0, 0))
        self.assertEqual(self.client.get(f"{BASE}/ordenes/{orden['id']}").json()["estado"], "CERRADA")

        # V2: trazabilidad inmutable del bulto
        traz = self.client.get(f"{BASE}/bultos/{bulto_agua}/trazabilidad").json()
        self.assertEqual(len(traz["eventos"]), 5)

        # P7: el local ya vende el agua verificada, pero no la gaseosa rechazada
        venta = self.client.post(
            "/api/ventas",
            json={"local_id": LOCAL_ID, "items": [{"producto_id": AGUA, "cantidad": 3}], "pago": TRANSFERENCIA},
        )
        self.assertEqual(venta.status_code, 201, venta.text)
        self.assertEqual(self._stock(AGUA, LOCAL_ID), (7, 0))
        sin_stock = self.client.post(
            "/api/ventas",
            json={"local_id": LOCAL_ID, "items": [{"producto_id": GASEOSA, "cantidad": 1}], "pago": TRANSFERENCIA},
        )
        self.assertEqual(sin_stock.status_code, 400)

    def test_codigos_http_de_errores(self) -> None:
        orden = self._post(
            "/ordenes", {"origen_id": CD_ID, "destino_id": LOCAL_ID, "items": [{"producto_id": AGUA, "cantidad": 60}]}, 201
        )
        self._post("/precintos", {"codigo": "SEAL-1"}, 201)

        casos = [
            ("POST", "/remitos/REM-INEXISTENTE/cerrar", None, 404),
            ("GET", "/ordenes/999", None, 404),
            ("GET", "/bultos/999", None, 404),
            ("GET", "/bultos/999/trazabilidad", None, 404),
            ("POST", "/precintos", {"codigo": "SEAL-1"}, 409),
            ("POST", f"/ordenes/{orden['id']}/bultos", {"items": [{"producto_id": AGUA, "cantidad": 51}]}, 400),
            ("POST", "/ordenes", {"origen_id": LOCAL_ID, "destino_id": CD_ID, "items": [{"producto_id": AGUA, "cantidad": 1}]}, 404),
            ("POST", "/ordenes", {"origen_id": CD_ID, "destino_id": LOCAL_ID, "items": [{"producto_id": 99, "cantidad": 1}]}, 404),
            ("POST", "/ordenes", {"origen_id": "CD-CENTRAL", "destino_id": LOCAL_ID, "items": [{"producto_id": AGUA, "cantidad": 1}]}, 400),
            ("POST", f"/remitos?orden_id={orden['id']}", {"numero": "R", "bultos_ids": ["abc"]}, 400),
            ("GET", f"/bultos/{10**30}", None, 400),
        ]
        for metodo, url, body, estado in casos:
            with self.subTest(metodo=metodo, url=url):
                res = self.client.request(metodo, f"{BASE}{url}", json=body)
                self.assertEqual(res.status_code, estado, res.text)
        self.assertEqual(self._stock(AGUA, CD_ID), (50, 0))

    def test_remito_duplicado_devuelve_409(self) -> None:
        orden = self._post(
            "/ordenes", {"origen_id": CD_ID, "destino_id": LOCAL_ID, "items": [{"producto_id": AGUA, "cantidad": 2}]}, 201
        )
        b1 = self._bulto_precintado(orden["id"], AGUA, 1, "SEAL-1")
        b2 = self._bulto_precintado(orden["id"], AGUA, 1, "SEAL-2")
        primero = self.client.post(f"{BASE}/remitos", params={"orden_id": orden["id"]}, json={"numero": "R-1", "bultos_ids": [b1]})
        repetido = self.client.post(f"{BASE}/remitos", params={"orden_id": orden["id"]}, json={"numero": "R-1", "bultos_ids": [b2]})

        self.assertEqual((primero.status_code, repetido.status_code), (201, 409))


if __name__ == "__main__":
    unittest.main()
