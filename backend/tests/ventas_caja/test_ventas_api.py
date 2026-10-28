"""Flujo HTTP de punta a punta de ventas, comprobante, devoluciones y caja (P7, V3, V5)."""

from datetime import date
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

LOCAL_ID = 2
OTRO_LOCAL_ID = 3
TARJETA = {"medio": "TARJETA", "numero_tarjeta": "4509953566233704", "cuotas": 3}
TRANSFERENCIA = {"medio": "TRANSFERENCIA", "cbu_o_alias": "mi.alias.mp", "codigo_transaccion": "TX-77"}


class TestVentasAPI(unittest.TestCase):
    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "test_ventas.sqlite3"
        self.app = Application_Factory.crear_aplicacion(database_url=f"sqlite:///{self.db_path.as_posix()}")
        self.client = TestClient(self.app)
        self._autenticar_admin_demo()
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
                    (2, 'LOCAL', 'Local Centro', 'San Martín 100'),
                    (3, 'LOCAL', 'Local Norte', 'Rivadavia 200');
                INSERT INTO categorias (id, nombre) VALUES (1, 'Bebidas');
                INSERT INTO proveedores (id, cuit, razon_social, telefono, email)
                    VALUES (1, '20123456789', 'Prov SA', '111', 'p@p.com');
                INSERT INTO productos (id, codigo, nombre, precio_venta, costo_unitario, categoria_id, proveedor_id)
                    VALUES (1, 'P1', 'Agua', 100.0, 50.0, 1, 1), (2, 'P2', 'Gaseosa', 250.0, 120.0, 1, 1);
                INSERT INTO stocks (producto_id, ubicacion_id, cantidad_disponible) VALUES
                    (1, 2, 10), (2, 2, 2), (1, 3, 5);
                """
            )

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

    def _disponible(self, producto_id: int, local_id: int) -> int:
        with sqlite3.connect(self.db_path) as conexion:
            return conexion.execute(
                "SELECT cantidad_disponible FROM stocks WHERE producto_id = ? AND ubicacion_id = ?",
                (producto_id, local_id),
            ).fetchone()[0]

    def _vender(self, items: list[dict], pago: dict, local_id: int = LOCAL_ID):
        return self.client.post("/api/ventas", json={"local_id": local_id, "items": items, "pago": pago})

    def test_flujo_completo_venta_comprobante_devolucion_y_caja(self) -> None:
        # 1. Venta en efectivo con vuelto
        res = self._vender(
            [{"producto_id": 1, "cantidad": 2}, {"producto_id": 2, "cantidad": 1}],
            {"medio": "EFECTIVO", "monto_recibido": "500"},
        )
        self.assertEqual(res.status_code, 201, res.text)
        venta = res.json()
        self.assertEqual(venta["total"], "450.00")
        self.assertEqual(venta["medio_pago"], "EFECTIVO")
        self.assertEqual(venta["numero_comprobante"], "0002-00000001")
        self.assertEqual(self._disponible(1, LOCAL_ID), 8)
        self.assertEqual(self._disponible(2, LOCAL_ID), 1)

        # 2. Comprobante
        res = self.client.get(f"/api/ventas/{venta['id']}/comprobante")
        self.assertEqual(res.status_code, 200)
        comprobante = res.json()
        self.assertEqual(comprobante["vuelto"], "50.00")
        self.assertEqual(len(comprobante["items"]), 2)

        # 3. Tarjeta en 3 cuotas (+10%) y transferencia
        res = self._vender([{"producto_id": 1, "cantidad": 1}], TARJETA)
        self.assertEqual(res.status_code, 201, res.text)
        self.assertEqual(res.json()["total_cobrado"], "110.00")
        self.assertEqual(res.json()["numero_comprobante"], "0002-00000002")

        res = self._vender([{"producto_id": 1, "cantidad": 1}], TRANSFERENCIA)
        self.assertEqual(res.status_code, 201, res.text)

        # 4. Devolución parcial: reingresa stock
        res = self.client.post(
            f"/api/ventas/{venta['id']}/devoluciones",
            json={"local_id": LOCAL_ID, "motivo": "Envase roto", "items": [{"producto_id": 1, "cantidad": 1}]},
        )
        self.assertEqual(res.status_code, 201, res.text)
        self.assertEqual(res.json()["monto_reintegrado"], "100.00")
        self.assertEqual(res.json()["medio_pago"], "EFECTIVO")
        self.assertEqual(self._disponible(1, LOCAL_ID), 7)

        # 5. Devolución de más: 400 y el stock no cambia
        res = self.client.post(
            f"/api/ventas/{venta['id']}/devoluciones",
            json={"local_id": LOCAL_ID, "motivo": "Otra", "items": [{"producto_id": 1, "cantidad": 2}]},
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self._disponible(1, LOCAL_ID), 7)
        self.assertEqual(len(self.client.get(f"/api/ventas/{venta['id']}/devoluciones").json()), 1)

        # 6. Caja del día: 450 + 110 + 100 - 100
        hoy = date.today().isoformat()
        res = self.client.get(f"/api/caja/{LOCAL_ID}", params={"desde": hoy, "hasta": hoy})
        self.assertEqual(res.status_code, 200, res.text)
        caja = res.json()
        self.assertEqual(caja["cantidad_ventas"], 3)
        self.assertEqual(caja["total_ventas"], "660.00")
        self.assertEqual(caja["total_devoluciones"], "100.00")
        self.assertEqual(caja["saldo"], "560.00")

        # 7. Listado por local
        self.assertEqual(len(self.client.get("/api/ventas", params={"local_id": LOCAL_ID}).json()), 3)

    def test_falta_de_stock_rechaza_la_venta_completa_y_revierte(self) -> None:
        res = self._vender(
            [{"producto_id": 1, "cantidad": 1}, {"producto_id": 2, "cantidad": 5}],
            TRANSFERENCIA,
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn("Stock insuficiente", res.json()["detail"])
        self.assertEqual(self._disponible(1, LOCAL_ID), 10)
        self.assertEqual(self.client.get("/api/ventas").json(), [])

    def test_pago_rechazado_devuelve_400(self) -> None:
        res = self._vender([{"producto_id": 1, "cantidad": 1}], {**TARJETA, "cuotas": 5})

        self.assertEqual(res.status_code, 400)
        self.assertEqual(self._disponible(1, LOCAL_ID), 10)

    def test_venta_inexistente_devuelve_404(self) -> None:
        self.assertEqual(self.client.get("/api/ventas/999").status_code, 404)
        res = self.client.post(
            "/api/ventas/999/devoluciones",
            json={"local_id": LOCAL_ID, "motivo": "x", "items": [{"producto_id": 1, "cantidad": 1}]},
        )
        self.assertEqual(res.status_code, 404)

    def test_devolucion_desde_otro_local_devuelve_404(self) -> None:
        venta = self._vender([{"producto_id": 1, "cantidad": 1}], TRANSFERENCIA).json()

        res = self.client.post(
            f"/api/ventas/{venta['id']}/devoluciones",
            json={"local_id": OTRO_LOCAL_ID, "motivo": "x", "items": [{"producto_id": 1, "cantidad": 1}]},
        )
        self.assertEqual(res.status_code, 404)

    def test_producto_o_local_inexistente_devuelven_404(self) -> None:
        self.assertEqual(self._vender([{"producto_id": 99, "cantidad": 1}], TRANSFERENCIA).status_code, 404)
        self.assertEqual(
            self._vender([{"producto_id": 1, "cantidad": 1}], TRANSFERENCIA, local_id=1).status_code, 404
        )

    def test_request_invalido_devuelve_400(self) -> None:
        casos = [
            {"local_id": LOCAL_ID, "items": [], "pago": TRANSFERENCIA},
            {"local_id": LOCAL_ID, "items": [{"producto_id": 1, "cantidad": 0}], "pago": TRANSFERENCIA},
            {"local_id": LOCAL_ID, "items": [{"producto_id": 1, "cantidad": 1}], "pago": {"medio": "CHEQUE"}},
        ]
        for cuerpo in casos:
            with self.subTest(cuerpo=cuerpo):
                self.assertEqual(self.client.post("/api/ventas", json=cuerpo).status_code, 400)

    def test_valores_fuera_de_rango_devuelven_400_y_no_500(self) -> None:
        enorme = 10**30
        item = {"producto_id": 1, "cantidad": 1}
        cuerpos = [
            {"local_id": LOCAL_ID, "items": [item], "pago": {"medio": "EFECTIVO", "monto_recibido": "1e30"}},
            {"local_id": LOCAL_ID, "items": [item], "pago": {"medio": "EFECTIVO", "monto_recibido": "10.001"}},
            {"local_id": LOCAL_ID, "items": [{"producto_id": enorme, "cantidad": 1}], "pago": TRANSFERENCIA},
            {"local_id": LOCAL_ID, "items": [{"producto_id": 1, "cantidad": enorme}], "pago": TRANSFERENCIA},
            {"local_id": enorme, "items": [item], "pago": TRANSFERENCIA},
            {"local_id": LOCAL_ID, "items": [item], "pago": {**TARJETA, "cuotas": True}},
        ]
        for cuerpo in cuerpos:
            with self.subTest(cuerpo=cuerpo):
                self.assertEqual(self.client.post("/api/ventas", json=cuerpo).status_code, 400)

        hoy = date.today().isoformat()
        for url in (f"/api/ventas/{enorme}", f"/api/ventas/{enorme}/comprobante", f"/api/caja/{enorme}?desde={hoy}&hasta={hoy}"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 400)
        self.assertEqual(self._disponible(1, LOCAL_ID), 10)

    def test_producto_sin_stock_en_el_local_devuelve_400(self) -> None:
        res = self._vender([{"producto_id": 2, "cantidad": 1}], TRANSFERENCIA, local_id=OTRO_LOCAL_ID)

        self.assertEqual(res.status_code, 400)
        self.assertIn("Stock insuficiente", res.json()["detail"])

    def test_devolucion_con_una_linea_invalida_no_reingresa_nada(self) -> None:
        venta = self._vender(
            [{"producto_id": 1, "cantidad": 2}, {"producto_id": 2, "cantidad": 1}], TRANSFERENCIA
        ).json()

        res = self.client.post(
            f"/api/ventas/{venta['id']}/devoluciones",
            json={
                "local_id": LOCAL_ID,
                "motivo": "x",
                "items": [{"producto_id": 1, "cantidad": 1}, {"producto_id": 2, "cantidad": 2}],
            },
        )

        self.assertEqual(res.status_code, 400)
        self.assertEqual((self._disponible(1, LOCAL_ID), self._disponible(2, LOCAL_ID)), (8, 1))
        self.assertEqual(self.client.get(f"/api/ventas/{venta['id']}/devoluciones").json(), [])

    def test_caja_con_fechas_invertidas_devuelve_400(self) -> None:
        res = self.client.get(f"/api/caja/{LOCAL_ID}", params={"desde": "2026-02-01", "hasta": "2026-01-01"})

        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
