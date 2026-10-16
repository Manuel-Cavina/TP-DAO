from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi.testclient import TestClient
from sqlalchemy import text

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton


class TestLogisticaAPI(unittest.TestCase):
    """Pruebas de integracion HTTP sobre los endpoints de logistica mediante Application_Factory y Session Middleware."""

    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self._temp_dir.name) / "test_api.sqlite3"
        self.db_url = f"sqlite:///{db_path.as_posix()}"

        self.app = Application_Factory.crear_aplicacion(database_url=self.db_url)
        self.client = TestClient(self.app)
        session = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        session.execute(text("INSERT INTO categorias (id, nombre) VALUES (1, 'General')"))
        session.execute(text("INSERT INTO proveedores (id, cuit, razon_social, telefono, email, activo) VALUES (1, '20123456789', 'Proveedor', '123', 'proveedor@example.com', 1)"))
        session.execute(text("INSERT INTO productos (id, codigo, nombre, precio_venta, costo_unitario, categoria_id, proveedor_id, activo) VALUES (1, 'PROD-10', 'Producto', 100, 50, 1, 1, 1)"))
        session.execute(text("INSERT INTO ubicaciones (id, tipo, nombre, direccion, telefono, activo) VALUES (1, 'CD', 'CD', 'Calle 1', NULL, 1), (2, 'LOCAL', 'Local Sur', 'Calle 2', '456', 1)"))
        session.execute(text("INSERT INTO stocks (producto_id, ubicacion_id, cantidad_disponible, cantidad_en_transito, nivel_minimo_existencia) VALUES (1, 1, 20, 0, 1), (1, 2, 0, 0, 1)"))
        session.commit()
        self.producto_id = 1
        self.cd_id = 1
        self.local_id = 2
        session.close()

    def tearDown(self) -> None:
        try:
            engine = Database_Engine_Singleton.obtener_instancia(self.db_url)
            engine.dispose()
        except Exception:
            pass
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except Exception:
            pass

    def test_health_check(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_flujo_api_completo(self) -> None:
        # 1. Registrar necesidades y listar
        res_nec = self.client.post(
            "/api/logistica/necesidades",
            json={"producto_id": self.producto_id, "local_id": self.local_id, "cantidad": 8},
        )
        self.assertEqual(res_nec.status_code, 201)

        res_list_nec = self.client.get(f"/api/logistica/necesidades?local_id={self.local_id}")
        self.assertEqual(res_list_nec.status_code, 200)
        self.assertEqual(len(res_list_nec.json()), 1)

        # 2. Consolidar en Orden de Reposicion
        res_cons = self.client.post(
            "/api/logistica/ordenes/consolidar",
            json={"local_destino_id": self.local_id, "origen_id": self.cd_id},
        )
        self.assertEqual(res_cons.status_code, 201)
        orden = res_cons.json()
        orden_id = orden["id"]
        self.assertEqual(orden["estado"], "PENDIENTE")

        # 3. Empaquetar bulto
        res_bulto = self.client.post(
            f"/api/logistica/ordenes/{orden_id}/bultos",
            json={"items": [{"producto_id": self.producto_id, "cantidad": 8}]},
        )
        self.assertEqual(res_bulto.status_code, 201)
        bulto = res_bulto.json()
        bulto_id = bulto["id"]
        self.assertEqual(bulto["estado"], "PREPARADO")

        # 4. Registrar precinto y precintar bulto
        res_prec = self.client.post(
            "/api/logistica/precintos",
            json={"codigo": "SEAL-001"},
        )
        self.assertEqual(res_prec.status_code, 201)

        res_precintar = self.client.post(
            f"/api/logistica/bultos/{bulto_id}/precintar",
            json={"codigo_precinto": "SEAL-001"},
        )
        self.assertEqual(res_precintar.status_code, 200)
        self.assertEqual(res_precintar.json()["estado"], "PRECINTADO")

        # 5. Generar remito y despachar
        res_rem = self.client.post(
            f"/api/logistica/remitos?orden_id={orden_id}",
            json={"numero": "REM-2026-01", "bultos_ids": [bulto_id]},
        )
        self.assertEqual(res_rem.status_code, 201)
        self.assertEqual(res_rem.json()["estado"], "EMITIDO")

        res_desp = self.client.post("/api/logistica/remitos/REM-2026-01/despachar")
        self.assertEqual(res_desp.status_code, 200)
        self.assertEqual(res_desp.json()["estado"], "DESPACHADO")

        # 6. Recibir remito en local
        res_recib = self.client.post("/api/logistica/remitos/REM-2026-01/recibir")
        self.assertEqual(res_recib.status_code, 200)

        # 7. Verificar precinto fisico
        res_verif = self.client.post(
            f"/api/logistica/bultos/{bulto_id}/verificar",
            json={"codigo_precinto_recibido": "SEAL-001", "esta_intacto": True},
        )
        self.assertEqual(res_verif.status_code, 200)
        self.assertEqual(res_verif.json()["estado"], "VERIFICADO")

        # 8. Cerrar remito e impactar stock
        res_cierre = self.client.post("/api/logistica/remitos/REM-2026-01/cerrar")
        self.assertEqual(res_cierre.status_code, 200)
        cierre_data = res_cierre.json()
        self.assertEqual(cierre_data["estado"], "CERRADO")
        self.assertEqual(cierre_data["bultos_verificados"], 1)
        self.assertEqual(cierre_data["unidades_acreditadas"], 8)

        # 9. Trazabilidad
        res_traz = self.client.get(f"/api/logistica/bultos/{bulto_id}/trazabilidad")
        self.assertEqual(res_traz.status_code, 200)
        traz_data = res_traz.json()
        self.assertEqual(traz_data["estado_actual"], "VERIFICADO")
        self.assertEqual(len(traz_data["eventos"]), 5)

    def test_error_transicion_invalida_retorna_400(self) -> None:
        res = self.client.post("/api/logistica/remitos/REM-INEXISTENTE/cerrar")
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
