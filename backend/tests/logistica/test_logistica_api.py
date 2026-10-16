from contextlib import contextmanager
from pathlib import Path
import sqlite3
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi.testclient import TestClient
from main import app
from modules.logistica.api.logistica_router import (
    get_despacho_service,
    get_empaquetado_service,
    get_recepcion_service,
    get_reposicion_service,
    get_trazabilidad_service,
)
from modules.logistica.application import (
    Despacho_Service,
    Empaquetado_Service,
    Mock_Stock_Service,
    Recepcion_Service,
    Reposicion_Service,
    Trazabilidad_Service,
)
from modules.logistica.infrastructure import (
    Bulto_Repository,
    Historial_Bulto_Repository,
    Necesidad_Reposicion_Repository,
    Orden_Reposicion_Repository,
    Precinto_Repository,
    Remito_Repository,
    crear_tablas_logistica,
)


class TestLogisticaAPI(unittest.TestCase):
    """Pruebas de integracion HTTP sobre los endpoints de logistica."""

    def setUp(self) -> None:
        # check_same_thread=False permite que los worker threads de FastAPI interactuen con la misma conexion
        self.conn = sqlite3.connect("file:test_api_db?mode=memory&cache=shared", uri=True, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        crear_tablas_logistica(self.conn)

        @contextmanager
        def conn_factory():
            try:
                yield self.conn
                self.conn.commit()
            except Exception:
                self.conn.rollback()
                raise

        stock_mock = Mock_Stock_Service()
        bulto_repo = Bulto_Repository()
        precinto_repo = Precinto_Repository()
        remito_repo = Remito_Repository(bulto_repo)
        orden_repo = Orden_Reposicion_Repository()
        necesidad_repo = Necesidad_Reposicion_Repository()
        historial_repo = Historial_Bulto_Repository()

        # Inyectar servicios con base en memoria en el router para pruebas aisladas
        self.reposicion_service = Reposicion_Service(
            orden_repo, necesidad_repo, conn_factory
        )
        self.empaquetado_service = Empaquetado_Service(
            bulto_repo, orden_repo, precinto_repo, remito_repo, stock_mock, conn_factory
        )
        self.despacho_service = Despacho_Service(
            remito_repo, bulto_repo, orden_repo, stock_mock, conn_factory
        )
        self.recepcion_service = Recepcion_Service(
            remito_repo, bulto_repo, orden_repo, stock_mock, conn_factory
        )
        self.trazabilidad_service = Trazabilidad_Service(
            historial_repo, bulto_repo, conn_factory
        )

        app.dependency_overrides[get_reposicion_service] = lambda: self.reposicion_service
        app.dependency_overrides[get_empaquetado_service] = lambda: self.empaquetado_service
        app.dependency_overrides[get_despacho_service] = lambda: self.despacho_service
        app.dependency_overrides[get_recepcion_service] = lambda: self.recepcion_service
        app.dependency_overrides[get_trazabilidad_service] = lambda: self.trazabilidad_service

        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.conn.close()

    def test_health_check(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_flujo_api_completo(self) -> None:
        # 1. Registrar necesidades y listar
        res_nec = self.client.post(
            "/api/logistica/necesidades",
            json={"producto_id": "PROD-10", "local_id": "LOCAL-SUR", "cantidad": 8},
        )
        self.assertEqual(res_nec.status_code, 201)

        res_list_nec = self.client.get("/api/logistica/necesidades?local_id=LOCAL-SUR")
        self.assertEqual(res_list_nec.status_code, 200)
        self.assertEqual(len(res_list_nec.json()), 1)

        # 2. Consolidar en Orden de Reposicion
        res_cons = self.client.post(
            "/api/logistica/ordenes/consolidar",
            json={"local_destino_id": "LOCAL-SUR", "origen_id": "CD-CENTRAL"},
        )
        self.assertEqual(res_cons.status_code, 201)
        orden = res_cons.json()
        orden_id = orden["id"]
        self.assertEqual(orden["estado"], "PENDIENTE")

        # 3. Empaquetar bulto
        res_bulto = self.client.post(
            f"/api/logistica/ordenes/{orden_id}/bultos",
            json={"items": [{"producto_id": "PROD-10", "cantidad": 8}]},
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
