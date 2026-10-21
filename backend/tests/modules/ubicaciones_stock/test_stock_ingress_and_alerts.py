"""Suite de pruebas para ingreso de mercadería al CD, alertas de stock mínimo (Observer),
listado con filtros e historial de movimientos (Tarea T033).
"""

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
from modules.ubicaciones_stock.application import Stock_Service
from modules.ubicaciones_stock.domain.exceptions import Stock_Insuficiente_Exception


class Test_Stock_Ingress_And_Alerts(unittest.TestCase):
    """Pruebas funcionales y de integración para el módulo de ubicaciones y stock."""

    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "test_stock_t033.sqlite3"
        self.app = Application_Factory.crear_aplicacion(database_url=f"sqlite:///{self.db_path.as_posix()}")
        self.client = TestClient(self.app)
        self._autenticar_admin_demo()

        # Sembrar entidades base: CD, Local, Categoría, Proveedor
        self.cd = self._post("/api/ubicaciones/centros-distribucion", {"nombre": "CD Central", "direccion": "Ruta 9 Km 40"})
        self.local = self._post("/api/ubicaciones/locales", {"nombre": "Local Palermo", "direccion": "Av. Santa Fe 3200", "telefono": "011-4444-5555"})
        self.categoria = self._post("/api/catalogo/categorias", {"nombre": "Bebidas"})
        self.proveedor = self._post(
            "/api/catalogo/proveedores",
            {"cuit": "30123456789", "razon_social": "Distribuidora SA", "telefono": "11223344", "email": "info@distribuidora.com"},
        )

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
        session = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        token = Request_Session_Context.establecer_sesion(session)
        try:
            Auth_Service().sembrar_identidades_defecto()
            session.commit()
        finally:
            Request_Session_Context.restablecer(token)
            session.close()

        respuesta = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@stocky.local", "password": "stocky-demo"},
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.text)

    def _crear_producto(self, codigo: str, nivel_minimo: int = 10) -> dict:
        body = {
            "codigo": codigo,
            "nombre": f"Producto {codigo}",
            "precio_venta": "1500.00",
            "costo_unitario": "900.00",
            "categoria_id": self.categoria["id"],
            "proveedor_id": self.proveedor["id"],
            "nivel_minimo_existencia": nivel_minimo,
        }
        return self._post("/api/catalogo/productos", body)

    # -------------------------------------------------------------------------
    # 1. Ingreso de mercadería al Centro de Distribución (POST /api/stock/ingresos)
    # -------------------------------------------------------------------------

    def test_ingreso_mercaderia_al_cd_incrementa_disponible(self) -> None:
        producto = self._crear_producto("PROD-001", nivel_minimo=10)
        p_id = producto["id"]
        cd_id = self.cd["id"]

        # Saldo inicial en CD debe ser 0
        inicial = self.client.get(f"/api/stock/{p_id}/{cd_id}").json()
        self.assertEqual(inicial["cantidad_disponible"], 0)

        # Primer ingreso de 50 unidades
        res1 = self._post("/api/stock/ingresos", {"producto_id": p_id, "cd_id": cd_id, "cantidad": 50})
        self.assertEqual(res1["cantidad_disponible"], 50)
        self.assertEqual(res1["producto_id"], p_id)
        self.assertEqual(res1["ubicacion_id"], cd_id)

        # Segundo ingreso acumulativo de 25 unidades
        res2 = self._post("/api/stock/ingresos", {"producto_id": p_id, "cd_id": cd_id, "cantidad": 25})
        self.assertEqual(res2["cantidad_disponible"], 75)

        # Consulta directa del stock en CD confirma 75 unidades disponibles
        stock_cd = self.client.get(f"/api/stock/{p_id}/{cd_id}").json()
        self.assertEqual(stock_cd["cantidad_disponible"], 75)

    def test_ingreso_rechaza_local_comercial_con_400(self) -> None:
        producto = self._crear_producto("PROD-002", nivel_minimo=5)
        p_id = producto["id"]
        local_id = self.local["id"]

        # Intentar ingresar directo al Local comercial debe responder 400
        res = self.client.post("/api/stock/ingresos", json={"producto_id": p_id, "cd_id": local_id, "cantidad": 30})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Centro de Distribución", res.json()["detail"])

    def test_ingreso_rechaza_cantidad_invalida_con_400(self) -> None:
        producto = self._crear_producto("PROD-003", nivel_minimo=5)
        p_id = producto["id"]
        cd_id = self.cd["id"]

        casos_invalidos = [
            0,
            -1,
            -100,
            "veinte",
        ]
        for cantidad in casos_invalidos:
            with self.subTest(cantidad=cantidad):
                res = self.client.post(
                    "/api/stock/ingresos",
                    json={"producto_id": p_id, "cd_id": cd_id, "cantidad": cantidad},
                )
                self.assertEqual(res.status_code, 400, res.text)

    def test_ingreso_rechaza_entidades_inexistentes_con_404(self) -> None:
        producto = self._crear_producto("PROD-004", nivel_minimo=5)
        p_id = producto["id"]
        cd_id = self.cd["id"]

        # CD inexistente
        res_cd = self.client.post("/api/stock/ingresos", json={"producto_id": p_id, "cd_id": 999999, "cantidad": 10})
        self.assertEqual(res_cd.status_code, 404)

        # Producto inexistente
        res_prod = self.client.post("/api/stock/ingresos", json={"producto_id": 999999, "cd_id": cd_id, "cantidad": 10})
        self.assertEqual(res_prod.status_code, 404)

    # -------------------------------------------------------------------------
    # 2. Alertas de stock mínimo (Observer) y marcado como leída
    # -------------------------------------------------------------------------

    def test_alerta_generada_al_descontar_a_o_por_debajo_de_minimo(self) -> None:
        producto = self._crear_producto("PROD-OBS-1", nivel_minimo=10)
        p_id = producto["id"]
        cd_id = self.cd["id"]

        # Ingresar 25 unidades al CD (> 10)
        self._post("/api/stock/ingresos", {"producto_id": p_id, "cd_id": cd_id, "cantidad": 25})

        # Alertas iniciales vacías
        alertas_previas = self.client.get("/api/stock/alertas", params={"ubicacion_id": cd_id}).json()
        self.assertEqual(len(alertas_previas), 0)

        # Descontar stock para que caiga exactamente a nivel mínimo (10)
        session = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        token = Request_Session_Context.establecer_sesion(session)
        try:
            stock_service = Stock_Service()
            stock_service.reservar_para_despacho(producto_id=p_id, cd_id=cd_id, cantidad=15)
            session.commit()
        finally:
            Request_Session_Context.restablecer(token)
            session.close()

        # El observador debió generar una alerta no leída
        alertas = self.client.get("/api/stock/alertas", params={"ubicacion_id": cd_id, "leida": False}).json()
        self.assertEqual(len(alertas), 1)
        alerta = alertas[0]
        self.assertEqual(alerta["producto_id"], p_id)
        self.assertEqual(alerta["ubicacion_id"], cd_id)
        self.assertEqual(alerta["cantidad_disponible"], 10)
        self.assertEqual(alerta["nivel_minimo"], 10)
        self.assertFalse(alerta["leida"])
        self.assertTrue(len(alerta["fecha_emision"]) > 0)

    def test_alerta_generada_al_aumentar_nivel_minimo_por_encima_de_disponible(self) -> None:
        producto = self._crear_producto("PROD-OBS-2", nivel_minimo=5)
        p_id = producto["id"]
        cd_id = self.cd["id"]

        # Ingresar 8 unidades al CD (8 > 5)
        self._post("/api/stock/ingresos", {"producto_id": p_id, "cd_id": cd_id, "cantidad": 8})

        # Elevar nivel mínimo a 15 (8 <= 15) mediante endpoint HTTP PUT
        res_put = self.client.put(f"/api/stock/{p_id}/{cd_id}/nivel-minimo", json={"nivel_minimo_existencia": 15})
        self.assertEqual(res_put.status_code, 200)
        self.assertEqual(res_put.json()["nivel_minimo_existencia"], 15)
        self.assertTrue(res_put.json()["en_o_bajo_minimo"])

        # Verificar generación de alerta por el observer
        alertas = self.client.get("/api/stock/alertas", params={"ubicacion_id": cd_id, "leida": False}).json()
        alerta = next((a for a in alertas if a["producto_id"] == p_id), None)
        self.assertIsNotNone(alerta)
        self.assertEqual(alerta["cantidad_disponible"], 8)
        self.assertEqual(alerta["nivel_minimo"], 15)

    def test_marcar_alerta_como_leida_exitoso_y_404_inexistente(self) -> None:
        producto = self._crear_producto("PROD-OBS-3", nivel_minimo=20)
        p_id = producto["id"]
        cd_id = self.cd["id"]

        # Ingresar 10 unidades (10 <= 20) -> pero al inicio tiene 0 unidades.
        # Subir mínimo para forzar disparo de alerta
        self.client.put(f"/api/stock/{p_id}/{cd_id}/nivel-minimo", json={"nivel_minimo_existencia": 25})

        alertas = self.client.get("/api/stock/alertas", params={"leida": False, "ubicacion_id": cd_id}).json()
        alerta_id = alertas[0]["id"]

        # Marcar alerta como leída mediante POST /api/stock/alertas/{id}/leer
        res_leer = self.client.post(f"/api/stock/alertas/{alerta_id}/leer")
        self.assertEqual(res_leer.status_code, 200)
        self.assertTrue(res_leer.json()["leida"])

        # Verificar que ya no figura en solo no leídas
        no_leidas = self.client.get("/api/stock/alertas", params={"leida": False, "ubicacion_id": cd_id}).json()
        ids_no_leidas = [a["id"] for a in no_leidas]
        self.assertNotIn(alerta_id, ids_no_leidas)

        # Verificar que figura en leídas
        leidas = self.client.get("/api/stock/alertas", params={"leida": True, "ubicacion_id": cd_id}).json()
        ids_leidas = [a["id"] for a in leidas]
        self.assertIn(alerta_id, ids_leidas)

        # 404 al marcar alerta inexistente
        res_404 = self.client.post("/api/stock/alertas/999999/leer")
        self.assertEqual(res_404.status_code, 404)

    # -------------------------------------------------------------------------
    # 3. Listado de stock con filtros (GET /api/stock)
    # -------------------------------------------------------------------------

    def test_listar_stock_con_filtros(self) -> None:
        p1 = self._crear_producto("PROD-FLT-1", nivel_minimo=10)["id"]
        p2 = self._crear_producto("PROD-FLT-2", nivel_minimo=10)["id"]
        cd_id = self.cd["id"]
        local_id = self.local["id"]

        # Configurar saldos:
        # P1 en CD: 50 unidades (50 > 10, no bajo mínimo)
        self._post("/api/stock/ingresos", {"producto_id": p1, "cd_id": cd_id, "cantidad": 50})
        # P1 en Local: 0 unidades (0 <= 10, bajo mínimo)
        # P2 en CD: 0 unidades (0 <= 10, bajo mínimo)
        # P2 en Local: 0 unidades (0 <= 10, bajo mínimo)

        # 1. Filtro por ubicacion_id
        res_cd = self.client.get("/api/stock", params={"ubicacion_id": cd_id}).json()
        self.assertTrue(all(s["ubicacion_id"] == cd_id for s in res_cd))
        self.assertEqual({s["producto_id"] for s in res_cd}, {p1, p2})

        # 2. Filtro por producto_id
        res_p1 = self.client.get("/api/stock", params={"producto_id": p1}).json()
        self.assertTrue(all(s["producto_id"] == p1 for s in res_p1))
        self.assertEqual({s["ubicacion_id"] for s in res_p1}, {cd_id, local_id})

        # 3. Filtro por solo_bajo_minimo=True
        res_bajo = self.client.get("/api/stock", params={"solo_bajo_minimo": True}).json()
        self.assertTrue(all(s["en_o_bajo_minimo"] for s in res_bajo))
        # P1 en CD tiene 50 unidades (> 10), por ende no debe estar en la lista de bajo mínimo
        p1_en_cd = next((s for s in res_bajo if s["producto_id"] == p1 and s["ubicacion_id"] == cd_id), None)
        self.assertIsNone(p1_en_cd)

        # 4. Filtro combinado: ubicacion_id + producto_id
        res_comb = self.client.get("/api/stock", params={"ubicacion_id": cd_id, "producto_id": p1}).json()
        self.assertEqual(len(res_comb), 1)
        self.assertEqual(res_comb[0]["producto_id"], p1)
        self.assertEqual(res_comb[0]["ubicacion_id"], cd_id)
        self.assertEqual(res_comb[0]["cantidad_disponible"], 50)

        # 5. Filtro combinado: ubicacion_id + solo_bajo_minimo=True
        res_cd_bajo = self.client.get("/api/stock", params={"ubicacion_id": cd_id, "solo_bajo_minimo": True}).json()
        # En CD, solo P2 está bajo mínimo (P1 tiene 50)
        self.assertEqual([s["producto_id"] for s in res_cd_bajo], [p2])

    # -------------------------------------------------------------------------
    # 4. Historial o movimientos asociados (trazabilidad del ciclo de stock)
    # -------------------------------------------------------------------------

    def test_ciclo_completo_de_movimientos_y_saldos_de_stock(self) -> None:
        """Verifica la coherencia del ciclo de vida del stock:
        ingreso -> despacho -> tránsito -> recepción/verificación -> merma -> venta -> devolución.
        """
        producto = self._crear_producto("PROD-MOV-1", nivel_minimo=5)
        p_id = producto["id"]
        cd_id = self.cd["id"]
        local_id = self.local["id"]

        session = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        token = Request_Session_Context.establecer_sesion(session)
        try:
            service = Stock_Service()

            # 1. Estado inicial
            self.assertEqual(service.consultar_disponible(p_id, cd_id), 0)
            self.assertEqual(service.consultar_disponible(p_id, local_id), 0)

            # 2. Ingreso a CD (+100)
            service.ingresar_mercaderia_cd(p_id, cd_id, 100)
            self.assertEqual(service.consultar_disponible(p_id, cd_id), 100)

            # 3. Reserva para despacho en CD (-40) y puesta en tránsito a Local (+40)
            service.reservar_para_despacho(p_id, cd_id, 40)
            service.registrar_en_transito(p_id, local_id, 40)
            self.assertEqual(service.consultar_disponible(p_id, cd_id), 60)
            self.assertEqual(service.consultar_disponible(p_id, local_id), 0)
            stock_local = service.consultar_stock(p_id, local_id)
            self.assertEqual(stock_local.cantidad_en_transito, 40)

            # 4. Recepción y verificación conforme de bulto (+30 pasan de tránsito a disponible)
            service.acreditar_verificado(p_id, local_id, 30)
            self.assertEqual(service.consultar_disponible(p_id, local_id), 30)
            stock_local_post_verif = service.consultar_stock(p_id, local_id)
            self.assertEqual(stock_local_post_verif.cantidad_en_transito, 10)

            # 5. Registro de merma por bulto rechazado (-10 en tránsito sin habilitar disponible)
            service.registrar_merma(p_id, local_id, 10)
            stock_local_post_merma = service.consultar_stock(p_id, local_id)
            self.assertEqual(stock_local_post_merma.cantidad_en_transito, 0)
            self.assertEqual(service.consultar_disponible(p_id, local_id), 30)

            # 6. Descuento por venta en Local (-5)
            service.descontar_por_venta(p_id, local_id, 5)
            self.assertEqual(service.consultar_disponible(p_id, local_id), 25)

            # 7. Reingreso por devolución de cliente en Local (+2)
            service.reingresar_por_devolucion(p_id, local_id, 2)
            self.assertEqual(service.consultar_disponible(p_id, local_id), 27)

            # Invariante: no se puede reservar más de lo disponible
            with self.assertRaises(Stock_Insuficiente_Exception):
                service.reservar_para_despacho(p_id, cd_id, 1000)

            session.commit()
        finally:
            Request_Session_Context.restablecer(token)
            session.close()

        # Verificar reflejo en endpoints API
        stock_cd_api = self.client.get(f"/api/stock/{p_id}/{cd_id}").json()
        self.assertEqual(stock_cd_api["cantidad_disponible"], 60)
        self.assertEqual(stock_cd_api["cantidad_en_transito"], 0)

        stock_local_api = self.client.get(f"/api/stock/{p_id}/{local_id}").json()
        self.assertEqual(stock_local_api["cantidad_disponible"], 27)
        self.assertEqual(stock_local_api["cantidad_en_transito"], 0)


if __name__ == "__main__":
    unittest.main()
