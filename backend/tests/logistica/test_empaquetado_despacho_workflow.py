"""Suite de pruebas de empaquetado, precintado, aprobación y remito único completo (US4 / T052).

Cubre:
- Aprobación individual y por lote con desglose de aprobados vs bloqueados con motivo (T042, T043).
- Inmutabilidad: la aprobación NO añade estado al bulto; el bulto permanece en PRECINTADO (T042).
- Precintado individual y por lote revisado atómico: todos o ninguno (T044).
- Remito único completo: máximo un remito por orden, rechazo de remito parcial o segundo remito (T047).
- Cantidades empaquetadas deben igualar a las solicitadas en la orden (T047).
- Estados canónicos de remito: EMITIDO -> DESPACHADO -> RECIBIDO -> CERRADO (T049).
- Despacho completo: remito a DESPACHADO y todos sus bultos a EN_TRANSITO (T049).
- Integración HTTP de los endpoints de la API (T042, T043, T044, T047).
"""

from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from modules.logistica.application import (
    Despacho_Service,
    Empaquetado_Service,
    Recepcion_Service,
    Reposicion_Service,
    Trazabilidad_Service,
)
from modules.logistica.domain.exceptions import (
    Bulto_Invalido_Exception,
    Bulto_Vacio_Exception,
    Bulto_Ya_Aprobado_Exception,
    Precinto_Duplicado_Exception,
    Precinto_Invalido_Exception,
    Remito_Duplicado_Exception,
    Remito_Incompleto_Exception,
    Transicion_Estado_Invalida_Exception,
)
from modules.logistica.infrastructure import (
    Aprobacion_Bulto_Repository,
    Bulto_Repository,
    Orden_Reposicion_Repository,
    Precinto_Repository,
    Remito_Repository,
    Stock_Logistica_Adapter,
    Trazabilidad_Repository,
)
from modules.seguridad.application import Auth_Service
from sqlite_logistica_test_case import (
    CD_ID,
    LOCAL_ID,
    PRODUCTO_A,
    PRODUCTO_B,
    Sqlite_Test_Case,
)


class TestEmpaquetadoDespachoWorkflow(Sqlite_Test_Case):
    """Pruebas completas del flujo de empaquetado, precintado, aprobación y remito único (US4 / T052)."""

    def setUp(self) -> None:
        super().setUp()
        self.cargar_datos_integrante_1({PRODUCTO_A: 100, PRODUCTO_B: 100})
        self.adapter = Stock_Logistica_Adapter()
        self.bulto_repo = Bulto_Repository()
        self.orden_repo = Orden_Reposicion_Repository()
        self.precinto_repo = Precinto_Repository()
        self.remito_repo = Remito_Repository(self.bulto_repo)
        self.aprobacion_repo = Aprobacion_Bulto_Repository()
        self.trazabilidad_repo = Trazabilidad_Repository()

        self.reposicion_service = Reposicion_Service(self.adapter)
        self.empaquetado_service = Empaquetado_Service(
            stock_service=self.adapter,
            bulto_repository=self.bulto_repo,
            orden_repository=self.orden_repo,
            precinto_repository=self.precinto_repo,
            remito_repository=self.remito_repo,
            aprobacion_repository=self.aprobacion_repo,
            trazabilidad_repository=self.trazabilidad_repo,
        )
        self.despacho_service = Despacho_Service(
            stock_service=self.adapter,
            remito_repository=self.remito_repo,
            bulto_repository=self.bulto_repo,
            orden_repository=self.orden_repo,
        )
        self.recepcion_service = Recepcion_Service(
            stock_service=self.adapter,
            remito_repository=self.remito_repo,
            bulto_repository=self.bulto_repo,
            orden_repository=self.orden_repo,
            precinto_repository=self.precinto_repo,
        )
        self.trazabilidad_service = Trazabilidad_Service(
            trazabilidad_repository=self.trazabilidad_repo,
            orden_repository=self.orden_repo,
        )

    def _crear_orden_base(self, cant_a: int = 10, cant_b: int = 5):
        return self.reposicion_service.crear_orden_manual(
            origen_id=CD_ID,
            destino_id=LOCAL_ID,
            items=[
                {"producto_id": PRODUCTO_A, "cantidad": cant_a},
                {"producto_id": PRODUCTO_B, "cantidad": cant_b},
            ],
            actor="test_user",
        )

    def test_aprobacion_individual_exitosa_y_validaciones(self) -> None:
        """Verifica aprobación individual inmutable y validaciones (T042, T043)."""
        orden = self._crear_orden_base(cant_a=10, cant_b=5)

        # 1. Bulto en PREPARADO no puede aprobarse
        bulto = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 10}]
        )
        self.assertEqual(bulto.estado.nombre, "PREPARADO")
        self.assertFalse(bulto.esta_aprobado)

        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.empaquetado_service.aprobar_bulto(bulto.id)

        # 2. Precintar el bulto
        self.empaquetado_service.registrar_precinto("PR-IND-01")
        bulto_precintado = self.empaquetado_service.precintar_bulto(bulto.id, "PR-IND-01")
        self.assertEqual(bulto_precintado.estado.nombre, "PRECINTADO")
        self.assertFalse(bulto_precintado.esta_aprobado)

        # 3. Aprobar el bulto individualmente
        bulto_aprobado = self.empaquetado_service.aprobar_bulto(
            bulto.id, actor="Supervisor1", observacion="Control visual y peso OK"
        )

        # Inmutabilidad: el bulto NO agrega estado, permanece en PRECINTADO
        self.assertEqual(bulto_aprobado.estado.nombre, "PRECINTADO")
        self.assertTrue(bulto_aprobado.esta_aprobado)
        self.assertIsNotNone(bulto_aprobado.aprobacion)
        self.assertEqual(bulto_aprobado.aprobacion.actor, "Supervisor1")
        self.assertEqual(bulto_aprobado.aprobacion.observacion, "Control visual y peso OK")

        # Evidencia persistida en base de datos
        self.assertTrue(self.aprobacion_repo.esta_aprobado(bulto.id))
        evidencia = self.aprobacion_repo.obtener_por_bulto_id(bulto.id)
        self.assertIsNotNone(evidencia)
        self.assertEqual(evidencia.bulto_id, bulto.id)
        self.assertEqual(evidencia.actor, "Supervisor1")

        # Evento de trazabilidad registrado
        eventos = self.trazabilidad_repo.listar_por_entidad("BULTO", bulto.id)
        evento_aprobacion = next((e for e in eventos if e.accion == "APROBACION"), None)
        self.assertIsNotNone(evento_aprobacion)
        self.assertEqual(evento_aprobacion.estado_anterior, "PRECINTADO")
        self.assertEqual(evento_aprobacion.estado_nuevo, "PRECINTADO")
        self.assertEqual(evento_aprobacion.actor, "Supervisor1")

        # 4. Rechazar segunda aprobación (inmutable, no se puede duplicar)
        with self.assertRaises(Bulto_Ya_Aprobado_Exception):
            self.empaquetado_service.aprobar_bulto(bulto.id)

    def test_aprobacion_por_lote_elegibles_y_bloqueados_con_motivo(self) -> None:
        """Verifica evaluación por lote: aprueba elegibles y explica bloqueos con motivo (T043)."""
        orden = self._crear_orden_base(cant_a=10, cant_b=5)

        # B1: precintado y completo (elegible)
        b1 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 10}]
        )
        self.empaquetado_service.registrar_precinto("PR-LOT-01")
        self.empaquetado_service.precintar_bulto(b1.id, "PR-LOT-01")

        # B2: en PREPARADO (no precintado -> bloqueado)
        b2 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_B, "cantidad": 2}]
        )

        # B3: precintado y ya aprobado previamente (bloqueado por aprobado)
        b3 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_B, "cantidad": 3}]
        )
        self.empaquetado_service.registrar_precinto("PR-LOT-03")
        self.empaquetado_service.precintar_bulto(b3.id, "PR-LOT-03")
        self.empaquetado_service.aprobar_bulto(b3.id, actor="AuditorPrevio")

        # Ejecución conjunta de aprobación de elegibles
        res = self.empaquetado_service.aprobar_bultos_elegibles(
            orden.id, actor="OperadorLote", observacion="Aprobación masiva listos"
        )

        # Debe incluir b1 en approved
        self.assertEqual(res["approved"], [b1.id])

        # Debe incluir b2 y b3 en blocked con sus motivos
        blocked_ids = [b["id"] for b in res["blocked"]]
        self.assertIn(b2.id, blocked_ids)
        self.assertIn(b3.id, blocked_ids)

        motivo_b2 = next(b["motivo"] for b in res["blocked"] if b["id"] == b2.id)
        self.assertIn("PRECINTADO", motivo_b2)

        motivo_b3 = next(b["motivo"] for b in res["blocked"] if b["id"] == b3.id)
        self.assertIn("aprobado previamente", motivo_b3)

        # B1 ahora está efectivamente aprobado y persiste
        self.assertTrue(self.aprobacion_repo.esta_aprobado(b1.id))
        self.assertTrue(self.bulto_repo.obtener_por_id(b1.id).esta_aprobado)

        # B2 sigue en PREPARADO y no aprobado
        self.assertEqual(self.bulto_repo.obtener_por_id(b2.id).estado.nombre, "PREPARADO")
        self.assertFalse(self.aprobacion_repo.esta_aprobado(b2.id))

    def test_precintado_atomico_en_lote(self) -> None:
        """Verifica precintado atómico: todos o ninguno ante códigos inválidos o duplicados (T044)."""
        orden = self._crear_orden_base(cant_a=10, cant_b=5)
        b1 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 10}]
        )
        b2 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_B, "cantidad": 5}]
        )

        self.empaquetado_service.registrar_precinto("PR-AT-01")
        self.empaquetado_service.registrar_precinto("PR-AT-02")

        # Caso 1: Código repetido en la misma solicitud
        with self.assertRaises(Precinto_Duplicado_Exception):
            self.empaquetado_service.precintar_bultos_lote(
                orden.id,
                [
                    {"bulto_id": b1.id, "codigo_precinto": "PR-AT-01"},
                    {"bulto_id": b2.id, "codigo_precinto": "PR-AT-01"},
                ],
            )

        # Ninguno debió precintarse (atomicidad)
        self.assertEqual(self.bulto_repo.obtener_por_id(b1.id).estado.nombre, "PREPARADO")
        self.assertEqual(self.bulto_repo.obtener_por_id(b2.id).estado.nombre, "PREPARADO")

        # Caso 2: Un código no existente o no disponible
        with self.assertRaises(Precinto_Invalido_Exception):
            self.empaquetado_service.precintar_bultos_lote(
                orden.id,
                [
                    {"bulto_id": b1.id, "codigo_precinto": "PR-AT-01"},
                    {"bulto_id": b2.id, "codigo_precinto": "PR-INEXISTENTE"},
                ],
            )

        # Ninguno debió precintarse
        self.assertEqual(self.bulto_repo.obtener_por_id(b1.id).estado.nombre, "PREPARADO")
        self.assertEqual(self.bulto_repo.obtener_por_id(b2.id).estado.nombre, "PREPARADO")

        # Caso 3: Lote exitoso
        actualizados = self.empaquetado_service.precintar_bultos_lote(
            orden.id,
            [
                {"bulto_id": b1.id, "codigo_precinto": "PR-AT-01"},
                {"bulto_id": b2.id, "codigo_precinto": "PR-AT-02"},
            ],
        )
        self.assertEqual(len(actualizados), 2)
        self.assertEqual(actualizados[0].estado.nombre, "PRECINTADO")
        self.assertEqual(actualizados[1].estado.nombre, "PRECINTADO")
        self.assertFalse(self.precinto_repo.esta_disponible("PR-AT-01"))
        self.assertFalse(self.precinto_repo.esta_disponible("PR-AT-02"))

    def test_remito_unico_completo_rechazo_remito_parcial_o_segundo_remito(self) -> None:
        """Verifica remito único y completo: rechaza remitos parciales, sin aprobar o segundo remito (T047)."""
        orden = self._crear_orden_base(cant_a=10, cant_b=5)

        # Armar B1 con 10 de A (faltan 5 de B en la orden)
        b1 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 10}]
        )
        self.empaquetado_service.registrar_precinto("PR-REM-01")
        self.empaquetado_service.precintar_bulto(b1.id, "PR-REM-01")
        self.empaquetado_service.aprobar_bulto(b1.id)

        # Intento 1: Emitir remito cuando la orden aún NO está completamente empaquetada
        with self.assertRaises(Remito_Incompleto_Exception) as ctx:
            self.empaquetado_service.generar_remito("REM-100", orden.id, [b1.id], validar_aprobacion=True)
        self.assertIn("cantidades", str(ctx.exception).lower())

        # Armar B2 con 5 de B -> Ahora sí está todo empaquetado en la orden
        b2 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_B, "cantidad": 5}]
        )
        self.empaquetado_service.registrar_precinto("PR-REM-02")
        self.empaquetado_service.precintar_bulto(b2.id, "PR-REM-02")

        # Intento 2: B2 aún NO fue aprobado
        with self.assertRaises(Remito_Incompleto_Exception) as ctx:
            self.empaquetado_service.generar_remito("REM-100", orden.id, [b1.id, b2.id], validar_aprobacion=True)
        self.assertIn("aprobacion", str(ctx.exception).lower())

        # Intento 3: Intentar emitir remito parcial omitiendo B2
        with self.assertRaises(Remito_Incompleto_Exception) as ctx:
            self.empaquetado_service.generar_remito("REM-100", orden.id, [b1.id], validar_aprobacion=True)
        self.assertIn("todos los bultos", str(ctx.exception).lower())

        # Aprobar B2
        self.empaquetado_service.aprobar_bulto(b2.id)

        # Emisión exitosa de remito completo
        remito = self.empaquetado_service.generar_remito("REM-100", orden.id, [b1.id, b2.id], validar_aprobacion=True)
        self.assertEqual(remito.numero, "REM-100")
        self.assertEqual(remito.estado, "EMITIDO")
        self.assertEqual(len(remito.bultos), 2)
        self.assertEqual(remito.orden_id, orden.id)

        # Intento 4: Intentar emitir un segundo remito para la misma orden -> Remito_Duplicado_Exception
        with self.assertRaises(Remito_Duplicado_Exception) as ctx:
            self.empaquetado_service.generar_remito("REM-200", orden.id, [b1.id, b2.id], validar_aprobacion=True)
        self.assertIn("ya posee un remito", str(ctx.exception).lower())

    def test_despacho_completo_y_transicion_de_bultos_a_en_transito(self) -> None:
        """Verifica despacho completo del remito y transición de estados (T049)."""
        orden = self._crear_orden_base(cant_a=10, cant_b=5)
        b1 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 10}]
        )
        b2 = self.empaquetado_service.crear_bulto(
            orden.id, [{"producto_id": PRODUCTO_B, "cantidad": 5}]
        )

        self.empaquetado_service.registrar_precinto("PR-DESP-01")
        self.empaquetado_service.registrar_precinto("PR-DESP-02")
        self.empaquetado_service.precintar_bulto(b1.id, "PR-DESP-01")
        self.empaquetado_service.precintar_bulto(b2.id, "PR-DESP-02")
        self.empaquetado_service.aprobar_bulto(b1.id)
        self.empaquetado_service.aprobar_bulto(b2.id)

        remito = self.empaquetado_service.generar_remito("REM-300", orden.id, [b1.id, b2.id], validar_aprobacion=True)
        self.assertEqual(remito.estado, "EMITIDO")

        # Despachar remito completo
        despachado = self.despacho_service.despachar_remito("REM-300")
        self.assertEqual(despachado.estado, "DESPACHADO")

        # Todos los bultos transicionan a EN_TRANSITO
        b1_post = self.bulto_repo.obtener_por_id(b1.id)
        b2_post = self.bulto_repo.obtener_por_id(b2.id)
        self.assertEqual(b1_post.estado.nombre, "EN_TRANSITO")
        self.assertEqual(b2_post.estado.nombre, "EN_TRANSITO")

        # La orden transiciona a DESPACHADA
        orden_post = self.orden_repo.obtener_por_id(orden.id)
        self.assertEqual(orden_post.estado, "DESPACHADA")

        # Stock en tránsito acreditado en destino
        self.assertEqual(self.stock(PRODUCTO_A, LOCAL_ID), (0, 10))
        self.assertEqual(self.stock(PRODUCTO_B, LOCAL_ID), (0, 5))

        # Recepción física del remito pasa remito a RECIBIDO y bultos a RECIBIDO
        recibido = self.recepcion_service.recibir_remito("REM-300")
        self.assertEqual(recibido.estado, "RECIBIDO")
        self.assertEqual(self.remito_repo.obtener_por_numero("REM-300").estado, "RECIBIDO")
        self.assertEqual(self.bulto_repo.obtener_por_id(b1.id).estado.nombre, "RECIBIDO")


class TestEmpaquetadoDespachoHttpApi(unittest.TestCase):
    """Pruebas de integración HTTP de los endpoints de US4."""

    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "test_us4.sqlite3"
        self.client = TestClient(Application_Factory.crear_aplicacion(database_url=f"sqlite:///{self.db_path.as_posix()}"))
        self._cargar_datos_integrante_1()
        self._autenticar_admin_demo()

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

    def _post(self, url: str, json: dict | list | None = None, params: dict | None = None, expected: int = 200) -> dict | list:
        res = self.client.post(f"/api/logistica{url}", json=json, params=params)
        self.assertEqual(res.status_code, expected, res.text)
        return res.json()

    def test_flujo_completo_api_us4(self) -> None:
        # 1. Crear orden
        orden = self._post(
            "/ordenes",
            {
                "origen_id": 1,
                "destino_id": 2,
                "items": [{"producto_id": 1, "cantidad": 5}, {"producto_id": 2, "cantidad": 3}],
            },
            expected=201,
        )
        orden_id = orden["id"]

        # 2. Crear bultos
        b1 = self._post(f"/ordenes/{orden_id}/bultos", {"items": [{"producto_id": 1, "cantidad": 5}]}, expected=201)
        b2 = self._post(f"/ordenes/{orden_id}/bultos", {"items": [{"producto_id": 2, "cantidad": 3}]}, expected=201)

        # 3. Registrar precintos
        self._post("/precintos", {"codigo": "P-HTTP-01"}, expected=201)
        self._post("/precintos", {"codigo": "P-HTTP-02"}, expected=201)

        # 4. Precintar por lote revisado
        lote_res = self._post(
            f"/ordenes/{orden_id}/bultos/precintar",
            [
                {"bulto_id": b1["id"], "codigo_precinto": "P-HTTP-01"},
                {"bulto_id": b2["id"], "codigo_precinto": "P-HTTP-02"},
            ],
            expected=200,
        )
        self.assertEqual(len(lote_res), 2)
        self.assertEqual(lote_res[0]["estado"], "PRECINTADO")
        self.assertEqual(lote_res[1]["estado"], "PRECINTADO")

        # 5. Aprobar individual b1
        b1_aprobado = self._post(f"/bultos/{b1['id']}/aprobar", {"actor": "InspectorA"}, expected=200)
        self.assertEqual(b1_aprobado["estado"], "PRECINTADO")
        self.assertTrue(b1_aprobado["aprobado"])

        # Intentar remito con b2 sin aprobar -> 400
        remito_fallido = self.client.post(
            "/api/logistica/remitos",
            params={"orden_id": orden_id, "validar_aprobacion": True},
            json={"numero": "REM-HTTP-1", "bultos_ids": [b1["id"], b2["id"]]},
        )
        self.assertEqual(remito_fallido.status_code, 400)

        # 6. Aprobar elegibles en la orden -> B1 bloqueado (ya aprobado), B2 aprobado
        elegibles_res = self._post(f"/ordenes/{orden_id}/bultos/aprobar-elegibles", expected=200)
        self.assertEqual(elegibles_res["approved"], [b2["id"]])
        self.assertEqual(len(elegibles_res["blocked"]), 1)
        self.assertEqual(elegibles_res["blocked"][0]["id"], b1["id"])

        # 7. Generar remito completo único
        remito = self._post(
            "/remitos",
            {"bultos_ids": [b1["id"], b2["id"]]},
            params={"orden_id": orden_id, "validar_aprobacion": True},
            expected=201,
        )
        self.assertEqual(remito["estado"], "EMITIDO")
        self.assertRegex(remito["numero"], r"^RM-\d{6}$")

        # 8. Intentar segundo remito para la misma orden -> 409
        remito_dup = self.client.post(
            "/api/logistica/remitos",
            params={"orden_id": orden_id, "validar_aprobacion": True},
            json={"numero": "REM-HTTP-2", "bultos_ids": [b1["id"], b2["id"]]},
        )
        self.assertEqual(remito_dup.status_code, 409)

        # 9. Despachar remito completo
        despachado = self._post(f"/remitos/{remito['numero']}/despachar", expected=200)
        self.assertEqual(despachado["estado"], "DESPACHADO")


if __name__ == "__main__":
    unittest.main()
