"""Suite de pruebas de recepción, control de precintos, cierre de remito y trazabilidad (US5 / T062).

Cubre:
1. Control individual de precinto (T056):
   - Precinto intacto con código coincidente -> VERIFICADO + Control_Precinto + Evento_Trazabilidad.
   - Precinto violado con motivo -> RECHAZADO + Control_Precinto + Evento_Trazabilidad.
   - Precinto violado SIN motivo -> Motivo_Rechazo_Requerido_Exception / HTTP 400.
   - Código leído no coincide con el esperado -> RECHAZADO; si falta motivo, Motivo_Rechazo_Requerido_Exception / HTTP 400.
2. Control por lote revisado atómico (T057):
   - Control de múltiples bultos atómicamente con generación individual de Control_Precinto y Evento_Trazabilidad.
   - Rollback atómico ante rechazo sin motivo o bulto de otro remito: ningún bulto cambia de estado.
3. Cierre de remito y consecuencia en stock / merma (V1 / FR-010):
   - Rechazo de cierre si hay bultos pendientes (en RECIBIDO).
   - Cierre con acreditación de stock vendible para bultos verificados y merma formal para rechazados.
   - Transición de remito a CERRADO y de orden a CERRADA al completar sus remitos.
4. Alcance y permisos de Operador vs Admin (T055 / FR-036 / FR-037 / SC-018):
   - Operador asignado a LOCAL_ID opera exitosamente sobre remitos de LOCAL_ID.
   - Operador asignado a LOCAL_ID recibe 403 / Permiso_Insuficiente_Exception al operar sobre OTRO_LOCAL_ID.
   - Administrador opera sobre cualquier sucursal sin restricción.
5. Búsqueda global y trazabilidad consolidada (T061):
   - Búsqueda global por ID de orden, número de remito, ID de bulto y código de precinto.
   - Trazabilidad consolidada del remito con orden, bultos, controles de precinto y eventos temporales.
"""

from pathlib import Path
import sys
import tempfile

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
from modules.logistica.domain.control_precinto import Control_Precinto
from modules.logistica.domain.exceptions import (
    Motivo_Rechazo_Requerido_Exception,
    Remito_Incompleto_Exception,
    Transicion_Estado_Invalida_Exception,
)
from modules.logistica.dto.logistica_dtos import Item_Control_Bulto_Request_DTO
from modules.logistica.infrastructure import (
    Aprobacion_Bulto_Repository,
    Bulto_Repository,
    Control_Precinto_Repository,
    Orden_Reposicion_Repository,
    Precinto_Repository,
    Remito_Repository,
    Stock_Logistica_Adapter,
    Trazabilidad_Repository,
)
from modules.seguridad.domain.usuario import (
    ROL_ADMIN,
    ROL_OPERADOR,
    Asignacion_Operador,
    Usuario,
)
from modules.seguridad.infrastructure.seguridad_repository import Seguridad_Repository
from modules.seguridad.application.auth_service import Auth_Service
from sqlite_logistica_test_case import (
    CD_ID,
    LOCAL_ID,
    OTRO_LOCAL_ID,
    PRODUCTO_A,
    PRODUCTO_B,
    Sqlite_Test_Case,
)


class Test_Recepcion_Trazabilidad_Workflow(Sqlite_Test_Case):
    """Pruebas del flujo completo de recepción, verificación, control en lote, cierre y trazabilidad (US5 / T062)."""

    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "test_recepcion_us5.sqlite3"
        self.db_url = f"sqlite:///{self.db_path.as_posix()}"

        self.app = Application_Factory.crear_aplicacion(database_url=self.db_url)
        self.client = TestClient(self.app)

        self.engine = Database_Engine_Singleton.obtener_instancia(self.db_url)
        self.session = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        self._token = Request_Session_Context.establecer_sesion(self.session)

        self.cargar_datos_integrante_1({PRODUCTO_A: 100, PRODUCTO_B: 100})
        self._crear_usuarios()
        self.session.commit()

        self._inicializar_servicios()

    def tearDown(self) -> None:
        if hasattr(self, "client"):
            self.client.close()
        super().tearDown()
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def stock(self, producto_id: int, ubicacion_id: int) -> tuple[int, int] | None:
        self.session.commit()
        self.session.expire_all()
        return super().stock(producto_id, ubicacion_id)

    def _crear_usuarios(self) -> None:
        repo = Seguridad_Repository()

        admin = Usuario(
            nombre="Admin Stocky",
            login="admin@stocky.local",
            password_hash=Auth_Service.hashear_password("admin123"),
            rol=ROL_ADMIN,
            activo=True,
        )
        repo.guardar_usuario(admin)

        asig_local = Asignacion_Operador(
            reporting_cd_id=CD_ID,
            authorised_branch_ids=[LOCAL_ID],
            shift_label="Mañana",
            activo=True,
        )
        op_local = Usuario(
            nombre="Operador Local Centro",
            login="operador_local@stocky.local",
            password_hash=Auth_Service.hashear_password("operador123"),
            rol=ROL_OPERADOR,
            activo=True,
            asignacion=asig_local,
        )
        repo.guardar_usuario(op_local)

        asig_otro = Asignacion_Operador(
            reporting_cd_id=CD_ID,
            authorised_branch_ids=[OTRO_LOCAL_ID],
            shift_label="Tarde",
            activo=True,
        )
        op_otro = Usuario(
            nombre="Operador Local Norte",
            login="operador_otro@stocky.local",
            password_hash=Auth_Service.hashear_password("operador123"),
            rol=ROL_OPERADOR,
            activo=True,
            asignacion=asig_otro,
        )
        repo.guardar_usuario(op_otro)

    def _inicializar_servicios(self) -> None:
        self.adapter = Stock_Logistica_Adapter()
        self.bulto_repo = Bulto_Repository()
        self.orden_repo = Orden_Reposicion_Repository()
        self.precinto_repo = Precinto_Repository()
        self.remito_repo = Remito_Repository(self.bulto_repo)
        self.aprobacion_repo = Aprobacion_Bulto_Repository()
        self.trazabilidad_repo = Trazabilidad_Repository()
        self.control_precinto_repo = Control_Precinto_Repository()

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
            control_precinto_repository=self.control_precinto_repo,
            trazabilidad_repository=self.trazabilidad_repo,
        )
        self.trazabilidad_service = Trazabilidad_Service(
            bulto_repository=self.bulto_repo,
            trazabilidad_repository=self.trazabilidad_repo,
            orden_repository=self.orden_repo,
            remito_repository=self.remito_repo,
            control_precinto_repository=self.control_precinto_repo,
        )

    def _crear_cliente_autenticado(self, login: str, password: str = "operador123") -> TestClient:
        self.session.commit()
        client = TestClient(self.app)
        res = client.post("/api/seguridad/login", json={"login": login, "password": password})
        self.assertEqual(res.status_code, 200, res.text)
        return client

    def _crear_y_despachar_remito(
        self,
        numero: str,
        destino_id: int = LOCAL_ID,
        bultos_data: list[tuple[int, int, str]] | None = None,
    ):
        """Crea orden, empaqueta, precinta, aprueba y despacha un remito completo."""
        if bultos_data is None:
            bultos_data = [(PRODUCTO_A, 10, f"PR-{numero}-01"), (PRODUCTO_B, 5, f"PR-{numero}-02")]

        items_orden = [{"producto_id": p_id, "cantidad": cant} for p_id, cant, _ in bultos_data]
        orden = self.reposicion_service.crear_orden_manual(
            origen_id=CD_ID,
            destino_id=destino_id,
            items=items_orden,
            actor="admin",
        )

        bulto_ids = []
        for p_id, cant, precinto_cod in bultos_data:
            b = self.empaquetado_service.crear_bulto(orden.id, [{"producto_id": p_id, "cantidad": cant}])
            self.empaquetado_service.registrar_precinto(precinto_cod)
            self.empaquetado_service.precintar_bulto(b.id, precinto_cod)
            self.empaquetado_service.aprobar_bulto(b.id)
            bulto_ids.append(b.id)

        remito = self.empaquetado_service.generar_remito(
            numero=numero,
            orden_id=orden.id,
            bultos_ids=bulto_ids,
            validar_aprobacion=True,
        )
        self.despacho_service.despachar_remito(numero)
        self.session.commit()
        return orden, remito, bulto_ids

    # =========================================================================
    # 1. Control individual de precinto (T056)
    # =========================================================================

    def test_control_individual_precinto_intacto_coincidente(self) -> None:
        """Precinto intacto con código coincidente pasa a VERIFICADO y registra evidencia inmutable (T056)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-IND-01", LOCAL_ID)
        self.recepcion_service.recibir_remito(remito.numero)
        self.session.commit()

        b1_id = bulto_ids[0]
        codigo = "PR-REM-IND-01-01"

        # 1. Verificación exitosa vía servicio
        bulto_verificado = self.recepcion_service.verificar_bulto(
            bulto_id=b1_id,
            codigo_esperado=codigo,
            codigo_leido=codigo,
            resultado_precinto="INTACTO",
            motivo_rechazo="",
            actor="OperadorTest",
            ubicacion_id=LOCAL_ID,
        )
        self.session.commit()
        self.assertEqual(bulto_verificado.estado.nombre, "VERIFICADO")

        # 2. Evidencia de Control_Precinto persistida
        ctrl = self.control_precinto_repo.obtener_por_bulto(b1_id)
        self.assertIsNotNone(ctrl)
        self.assertEqual(ctrl.resultado, "VERIFICADO")
        self.assertEqual(ctrl.codigo_esperado, codigo)
        self.assertEqual(ctrl.codigo_leido, codigo)
        self.assertEqual(ctrl.actor, "OperadorTest")
        self.assertEqual(ctrl.ubicacion_id, LOCAL_ID)
        self.assertEqual(ctrl.motivo_rechazo, "")

        # 3. Evento de trazabilidad registrado
        eventos = self.trazabilidad_repo.listar_por_entidad("BULTO", b1_id)
        evento_ctrl = next((e for e in eventos if e.accion == "CONTROL_PRECINTO"), None)
        self.assertIsNotNone(evento_ctrl)
        self.assertEqual(evento_ctrl.estado_anterior, "RECIBIDO")
        self.assertEqual(evento_ctrl.estado_nuevo, "VERIFICADO")
        self.assertEqual(evento_ctrl.actor, "OperadorTest")

        # 4. Verificación vía endpoint HTTP para el segundo bulto
        b2_id = bulto_ids[1]
        codigo_b2 = "PR-REM-IND-01-02"
        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_http = client.post(
            f"/api/logistica/bultos/{b2_id}/verificar",
            json={
                "codigo_esperado": codigo_b2,
                "codigo_leido": codigo_b2,
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )
        self.assertEqual(res_http.status_code, 200, res_http.text)
        self.assertEqual(res_http.json()["estado"], "VERIFICADO")

    def test_control_individual_precinto_violado_con_motivo(self) -> None:
        """Precinto violado con motivo pasa a RECHAZADO y registra evidencia inmutable (T056)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-IND-02", LOCAL_ID)
        self.recepcion_service.recibir_remito(remito.numero)
        self.session.commit()

        b1_id = bulto_ids[0]
        codigo = "PR-REM-IND-02-01"
        motivo = "Precinto roto al arribo del camión"

        # Verificación vía API HTTP con motivo explícito
        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_http = client.post(
            f"/api/logistica/bultos/{b1_id}/verificar",
            json={
                "codigo_esperado": codigo,
                "codigo_leido": codigo,
                "resultado": "VIOLADO",
                "motivo_rechazo": motivo,
            },
        )
        self.assertEqual(res_http.status_code, 200, res_http.text)
        self.assertEqual(res_http.json()["estado"], "RECHAZADO")

        # Evidencia persistida
        self.session.commit()
        ctrl = self.control_precinto_repo.obtener_por_bulto(b1_id)
        self.assertIsNotNone(ctrl)
        self.assertEqual(ctrl.resultado, "RECHAZADO")
        self.assertEqual(ctrl.motivo_rechazo, motivo)

        # Evento de trazabilidad
        eventos = self.trazabilidad_repo.listar_por_entidad("BULTO", b1_id)
        evento_ctrl = next((e for e in eventos if e.accion == "CONTROL_PRECINTO"), None)
        self.assertIsNotNone(evento_ctrl)
        self.assertEqual(evento_ctrl.estado_nuevo, "RECHAZADO")
        self.assertEqual(evento_ctrl.motivo_o_evidencia, motivo)

    def test_control_individual_precinto_violado_sin_motivo_es_rechazado(self) -> None:
        """Precinto violado SIN motivo lanza Motivo_Rechazo_Requerido_Exception y error HTTP 400 (T056)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-IND-03", LOCAL_ID)
        self.recepcion_service.recibir_remito(remito.numero)
        self.session.commit()

        b1_id = bulto_ids[0]
        codigo = "PR-REM-IND-03-01"

        # 1. Nivel servicio: lanza excepción tipada
        with self.assertRaises(Motivo_Rechazo_Requerido_Exception):
            self.recepcion_service.verificar_bulto(
                bulto_id=b1_id,
                codigo_esperado=codigo,
                codigo_leido=codigo,
                resultado_precinto="VIOLADO",
                motivo_rechazo="",
            )

        # 2. Nivel entidad de dominio pura
        with self.assertRaises(Motivo_Rechazo_Requerido_Exception):
            Control_Precinto(
                bulto_id=b1_id,
                codigo_esperado=codigo,
                codigo_leido=codigo,
                resultado="RECHAZADO",
                motivo_rechazo="",
            )

        # 3. Nivel API HTTP: retorna 400
        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_http = client.post(
            f"/api/logistica/bultos/{b1_id}/verificar",
            json={
                "codigo_esperado": codigo,
                "codigo_leido": codigo,
                "resultado": "VIOLADO",
                "motivo_rechazo": "   ",
            },
        )
        self.assertEqual(res_http.status_code, 400)
        self.assertIn("motivo de rechazo", res_http.text.lower())

        # El bulto continúa en RECIBIDO
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(self.bulto_repo.obtener_por_id(b1_id).estado.nombre, "RECIBIDO")

    def test_control_individual_codigo_no_coincidente(self) -> None:
        """Código leído no coincidente fuerza RECHAZADO y exige motivo de rechazo (T056)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-IND-04", LOCAL_ID)
        self.recepcion_service.recibir_remito(remito.numero)
        self.session.commit()

        b1_id = bulto_ids[0]
        esperado = "PR-REM-IND-04-01"
        leido_distinto = "PR-ALTERADO-99"

        # 1. Sin motivo -> lanza Motivo_Rechazo_Requerido_Exception / HTTP 400
        with self.assertRaises(Motivo_Rechazo_Requerido_Exception):
            self.recepcion_service.verificar_bulto(
                bulto_id=b1_id,
                codigo_esperado=esperado,
                codigo_leido=leido_distinto,
                resultado_precinto="INTACTO",  # Aun reportado intacto, no coincide
                motivo_rechazo="",
            )

        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_fallo = client.post(
            f"/api/logistica/bultos/{b1_id}/verificar",
            json={
                "codigo_esperado": esperado,
                "codigo_leido": leido_distinto,
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )
        self.assertEqual(res_fallo.status_code, 400)

        # 2. Con motivo -> resultado forzado a RECHAZADO
        res_exito = client.post(
            f"/api/logistica/bultos/{b1_id}/verificar",
            json={
                "codigo_esperado": esperado,
                "codigo_leido": leido_distinto,
                "resultado": "INTACTO",
                "motivo_rechazo": "Código físico no coincide con el remito",
            },
        )
        self.assertEqual(res_exito.status_code, 200)
        self.assertEqual(res_exito.json()["estado"], "RECHAZADO")

        self.session.commit()
        ctrl = self.control_precinto_repo.obtener_por_bulto(b1_id)
        self.assertIsNotNone(ctrl)
        self.assertEqual(ctrl.resultado, "RECHAZADO")
        self.assertEqual(ctrl.codigo_esperado, esperado)
        self.assertEqual(ctrl.codigo_leido, leido_distinto)

    # =========================================================================
    # 2. Control por lote revisado atómico (T057)
    # =========================================================================

    def test_control_lote_revisado_exitoso_multiples_bultos(self) -> None:
        """Control por lote procesa múltiples bultos atómicamente con evidencia individual (T057)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-BATCH-01", LOCAL_ID)
        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_recibir = client.post(f"/api/logistica/remitos/{remito.numero}/recibir")
        self.assertEqual(res_recibir.status_code, 200)
        self.session.commit()
        self.session.expire_all()

        b1_id, b2_id = bulto_ids[0], bulto_ids[1]

        payload = {
            "items": [
                {
                    "bulto_id": b1_id,
                    "codigo_esperado": "PR-REM-BATCH-01-01",
                    "codigo_leido": "PR-REM-BATCH-01-01",
                    "resultado": "INTACTO",
                    "motivo_rechazo": "",
                },
                {
                    "bulto_id": b2_id,
                    "codigo_esperado": "PR-REM-BATCH-01-02",
                    "codigo_leido": "PR-REM-BATCH-01-02",
                    "resultado": "VIOLADO",
                    "motivo_rechazo": "Precinto adulterado en tránsito",
                },
            ]
        }

        res = client.post(f"/api/logistica/remitos/{remito.numero}/controlar-bultos", json=payload)
        self.assertEqual(res.status_code, 200, res.text)
        datos = res.json()
        self.assertEqual(datos["remito_numero"], remito.numero)
        self.assertEqual(datos["total_controlados"], 2)
        self.assertEqual(datos["verificados"], 1)
        self.assertEqual(datos["rechazados"], 1)

        # Estados de los bultos
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(self.bulto_repo.obtener_por_id(b1_id).estado.nombre, "VERIFICADO")
        self.assertEqual(self.bulto_repo.obtener_por_id(b2_id).estado.nombre, "RECHAZADO")

        # Control_Precinto individual para cada bulto
        ctrl1 = self.control_precinto_repo.obtener_por_bulto(b1_id)
        ctrl2 = self.control_precinto_repo.obtener_por_bulto(b2_id)
        self.assertIsNotNone(ctrl1)
        self.assertEqual(ctrl1.resultado, "VERIFICADO")
        self.assertIsNotNone(ctrl2)
        self.assertEqual(ctrl2.resultado, "RECHAZADO")
        self.assertEqual(ctrl2.motivo_rechazo, "Precinto adulterado en tránsito")

        # Evento_Trazabilidad individual con actor y fecha
        ev1 = self.trazabilidad_repo.listar_por_entidad("BULTO", b1_id)
        ev_ctrl1 = next((e for e in ev1 if e.accion == "CONTROL_PRECINTO"), None)
        self.assertIsNotNone(ev_ctrl1)
        self.assertEqual(ev_ctrl1.actor, "operador_local@stocky.local")
        self.assertIsNotNone(ev_ctrl1.fecha_hora)

        ev2 = self.trazabilidad_repo.listar_por_entidad("BULTO", b2_id)
        ev_ctrl2 = next((e for e in ev2 if e.accion == "CONTROL_PRECINTO"), None)
        self.assertIsNotNone(ev_ctrl2)
        self.assertEqual(ev_ctrl2.actor, "operador_local@stocky.local")
        self.assertEqual(ev_ctrl2.motivo_o_evidencia, "Precinto adulterado en tránsito")

    def test_control_lote_rollback_atomico_por_rechazo_sin_motivo(self) -> None:
        """Si un ítem en el lote carece de motivo de rechazo, falla toda la transacción atómicamente (T057)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-BATCH-02", LOCAL_ID)
        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_recibir = client.post(f"/api/logistica/remitos/{remito.numero}/recibir")
        self.assertEqual(res_recibir.status_code, 200)
        self.session.commit()
        self.session.expire_all()

        b1_id, b2_id = bulto_ids[0], bulto_ids[1]

        # 1. Nivel servicio: atomicidad previa a mutaciones
        items_dto = [
            Item_Control_Bulto_Request_DTO(
                bulto_id=b1_id,
                codigo_esperado="PR-REM-BATCH-02-01",
                codigo_leido="PR-REM-BATCH-02-01",
                resultado="INTACTO",
                motivo_rechazo="",
            ),
            Item_Control_Bulto_Request_DTO(
                bulto_id=b2_id,
                codigo_esperado="PR-REM-BATCH-02-02",
                codigo_leido="PR-REM-BATCH-02-02",
                resultado="VIOLADO",
                motivo_rechazo="",  # INVÁLIDO: sin motivo
            ),
        ]
        with self.assertRaises(Motivo_Rechazo_Requerido_Exception):
            self.recepcion_service.controlar_bultos_batch(
                remito_numero=remito.numero,
                items=items_dto,
                actor="test_user",
            )

        # Ninguno cambió de estado
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(self.bulto_repo.obtener_por_id(b1_id).estado.nombre, "RECIBIDO")
        self.assertEqual(self.bulto_repo.obtener_por_id(b2_id).estado.nombre, "RECIBIDO")

        # 2. Nivel API HTTP: retorna 400 y aplica rollback
        payload_http = {
            "items": [
                {
                    "bulto_id": b1_id,
                    "codigo_esperado": "PR-REM-BATCH-02-01",
                    "codigo_leido": "PR-REM-BATCH-02-01",
                    "resultado": "INTACTO",
                    "motivo_rechazo": "",
                },
                {
                    "bulto_id": b2_id,
                    "codigo_esperado": "PR-REM-BATCH-02-02",
                    "codigo_leido": "PR-REM-BATCH-02-02",
                    "resultado": "VIOLADO",
                    "motivo_rechazo": "",
                },
            ]
        }
        res_http = client.post(f"/api/logistica/remitos/{remito.numero}/controlar-bultos", json=payload_http)
        self.assertEqual(res_http.status_code, 400)

        # Verificación estricta de rollback en base de datos
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(self.bulto_repo.obtener_por_id(b1_id).estado.nombre, "RECIBIDO")
        self.assertEqual(self.bulto_repo.obtener_por_id(b2_id).estado.nombre, "RECIBIDO")
        self.assertIsNone(self.control_precinto_repo.obtener_por_bulto(b1_id))
        self.assertIsNone(self.control_precinto_repo.obtener_por_bulto(b2_id))

    def test_control_lote_rollback_atomico_por_bulto_de_otro_remito(self) -> None:
        """Si un ítem en el lote pertenece a otro remito, falla atómicamente sin mutaciones (T057)."""
        _, remito_a, bultos_a = self._crear_y_despachar_remito("REM-BATCH-03A", LOCAL_ID)
        _, remito_b, bultos_b = self._crear_y_despachar_remito("REM-BATCH-03B", LOCAL_ID)

        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        client.post(f"/api/logistica/remitos/{remito_a.numero}/recibir")
        client.post(f"/api/logistica/remitos/{remito_b.numero}/recibir")

        # Payload enviado a remito_a conteniendo un bulto de remito_b
        payload_cruzado = {
            "items": [
                {
                    "bulto_id": bultos_a[0],
                    "codigo_esperado": "PR-REM-BATCH-03A-01",
                    "codigo_leido": "PR-REM-BATCH-03A-01",
                    "resultado": "INTACTO",
                    "motivo_rechazo": "",
                },
                {
                    "bulto_id": bultos_b[0],  # Pertenece a remito_b
                    "codigo_esperado": "PR-REM-BATCH-03B-01",
                    "codigo_leido": "PR-REM-BATCH-03B-01",
                    "resultado": "INTACTO",
                    "motivo_rechazo": "",
                },
            ]
        }

        res_http = client.post(f"/api/logistica/remitos/{remito_a.numero}/controlar-bultos", json=payload_cruzado)
        self.assertEqual(res_http.status_code, 400)
        self.assertIn("no pertenece al remito", res_http.text.lower())

        # Ambos bultos intactos en RECIBIDO
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(self.bulto_repo.obtener_por_id(bultos_a[0]).estado.nombre, "RECIBIDO")
        self.assertEqual(self.bulto_repo.obtener_por_id(bultos_b[0]).estado.nombre, "RECIBIDO")

    # =========================================================================
    # 3. Cierre de remito y consecuencia de stock / merma (V1 / FR-010)
    # =========================================================================

    def test_cierre_remito_rechazado_con_bultos_pendientes(self) -> None:
        """El remito no puede cerrarse si aún tiene bultos pendientes de control (V1 / FR-010)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-CIERRE-01", LOCAL_ID)
        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_recibir = client.post(f"/api/logistica/remitos/{remito.numero}/recibir")
        self.assertEqual(res_recibir.status_code, 200)
        self.session.commit()
        self.session.expire_all()

        # 1. Intento con todos los bultos en RECIBIDO
        res_fallo = client.post(f"/api/logistica/remitos/{remito.numero}/cerrar")
        self.assertEqual(res_fallo.status_code, 400)
        self.assertIn("debe ser verificado o rechazado", res_fallo.text.lower())

        # 2. Controlar bulto 1 y dejar bulto 2 pendiente en RECIBIDO
        client.post(
            f"/api/logistica/bultos/{bulto_ids[0]}/verificar",
            json={
                "codigo_esperado": "PR-REM-CIERRE-01-01",
                "codigo_leido": "PR-REM-CIERRE-01-01",
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )
        res_fallo_parcial = client.post(f"/api/logistica/remitos/{remito.numero}/cerrar")
        self.assertEqual(res_fallo_parcial.status_code, 400)

        # El remito sigue en RECIBIDO
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(self.remito_repo.obtener_por_numero(remito.numero).estado, "RECIBIDO")

    def test_cierre_remito_consecuencia_stock_vendible_y_merma(self) -> None:
        """Cierre de remito: acredita stock de verificados y merma de rechazados en LOCAL_ID (V1 / FR-010)."""
        orden, remito, bulto_ids = self._crear_y_despachar_remito(
            "REM-CIERRE-02",
            LOCAL_ID,
            bultos_data=[
                (PRODUCTO_A, 10, "PR-REM-CIERRE-02-01"),
                (PRODUCTO_B, 5, "PR-REM-CIERRE-02-02"),
            ],
        )
        client = self._crear_cliente_autenticado("operador_local@stocky.local")
        res_recibir = client.post(f"/api/logistica/remitos/{remito.numero}/recibir")
        self.assertEqual(res_recibir.status_code, 200)
        self.session.commit()
        self.session.expire_all()

        # Estado inicial en LOCAL_ID: todo en tránsito, 0 disponible
        self.assertEqual(self.stock(PRODUCTO_A, LOCAL_ID), (0, 10))
        self.assertEqual(self.stock(PRODUCTO_B, LOCAL_ID), (0, 5))

        # Bulto 1 (10 de PRODUCTO_A) -> VERIFICADO
        client.post(
            f"/api/logistica/bultos/{bulto_ids[0]}/verificar",
            json={
                "codigo_esperado": "PR-REM-CIERRE-02-01",
                "codigo_leido": "PR-REM-CIERRE-02-01",
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )

        # Bulto 2 (5 de PRODUCTO_B) -> RECHAZADO con motivo
        client.post(
            f"/api/logistica/bultos/{bulto_ids[1]}/verificar",
            json={
                "codigo_esperado": "PR-REM-CIERRE-02-02",
                "codigo_leido": "PR-REM-CIERRE-02-02",
                "resultado": "VIOLADO",
                "motivo_rechazo": "Precinto destruido e insumos faltantes",
            },
        )

        # Cierre del remito
        res_cierre = client.post(f"/api/logistica/remitos/{remito.numero}/cerrar")
        self.assertEqual(res_cierre.status_code, 200, res_cierre.text)
        datos = res_cierre.json()
        self.assertEqual(datos["remito_numero"], remito.numero)
        self.assertEqual(datos["estado"], "CERRADO")
        self.assertEqual(datos["bultos_verificados"], 1)
        self.assertEqual(datos["bultos_rechazados"], 1)
        self.assertEqual(datos["unidades_acreditadas"], 10)
        self.assertEqual(datos["unidades_merma"], 5)

        # Consecuencia en stock:
        # PRODUCTO_A: 10 acreditadas a disponible, 0 en tránsito
        self.assertEqual(self.stock(PRODUCTO_A, LOCAL_ID), (10, 0))
        # PRODUCTO_B: 0 disponible (merma formal), 0 en tránsito
        self.assertEqual(self.stock(PRODUCTO_B, LOCAL_ID), (0, 0))

        # Remito cerrado
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(self.remito_repo.obtener_por_numero(remito.numero).estado, "CERRADO")

        # Al estar cerrados todos los bultos de la orden, la orden transiciona a CERRADA
        orden_cerrada = self.orden_repo.obtener_por_id(orden.id)
        self.assertEqual(orden_cerrada.estado, "CERRADA")

    # =========================================================================
    # 4. Alcance y permisos de Operador vs Admin (T055 / FR-036 / FR-037 / SC-018)
    # =========================================================================

    def test_alcance_operador_autorizado_en_su_sucursal(self) -> None:
        """Operador asignado a LOCAL_ID opera sin impedimentos en su sucursal (FR-037 / SC-018)."""
        _, remito, bulto_ids = self._crear_y_despachar_remito("REM-PERM-01", LOCAL_ID)
        client = self._crear_cliente_autenticado("operador_local@stocky.local")

        # 1. Listar remitos de su sucursal -> 200
        res_listar = client.get("/api/logistica/remitos", params={"destino_id": LOCAL_ID})
        self.assertEqual(res_listar.status_code, 200)

        # 2. Recibir remito -> 200
        res_recibir = client.post(f"/api/logistica/remitos/{remito.numero}/recibir")
        self.assertEqual(res_recibir.status_code, 200)

        # 3. Controlar bultos -> 200
        res_ctrl = client.post(
            f"/api/logistica/bultos/{bulto_ids[0]}/verificar",
            json={
                "codigo_esperado": "PR-REM-PERM-01-01",
                "codigo_leido": "PR-REM-PERM-01-01",
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )
        self.assertEqual(res_ctrl.status_code, 200)

    def test_alcance_operador_denegado_en_otra_sucursal(self) -> None:
        """Operador asignado a LOCAL_ID recibe 403 al intentar operar en OTRO_LOCAL_ID (FR-037 / SC-018)."""
        _, remito_otro, bultos_otro = self._crear_y_despachar_remito("REM-PERM-02", OTRO_LOCAL_ID)
        client_local = self._crear_cliente_autenticado("operador_local@stocky.local")

        # 1. Filtro explícito de remitos por otra sucursal -> 403
        res_listar = client_local.get("/api/logistica/remitos", params={"destino_id": OTRO_LOCAL_ID})
        self.assertEqual(res_listar.status_code, 403)
        self.assertIn("fuera del alcance", res_listar.text.lower())

        # 2. Intentar recibir remito de otra sucursal -> 403
        res_recibir = client_local.post(f"/api/logistica/remitos/{remito_otro.numero}/recibir")
        self.assertEqual(res_recibir.status_code, 403)
        self.assertIn("fuera del alcance", res_recibir.text.lower())

        # 3. Intentar verificar bulto de otra sucursal -> 403
        res_verificar = client_local.post(
            f"/api/logistica/bultos/{bultos_otro[0]}/verificar",
            json={
                "codigo_esperado": "PR-REM-PERM-02-01",
                "codigo_leido": "PR-REM-PERM-02-01",
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )
        self.assertEqual(res_verificar.status_code, 403)

        # 4. Intentar control por lote en otra sucursal -> 403
        res_batch = client_local.post(
            f"/api/logistica/remitos/{remito_otro.numero}/controlar-bultos",
            json={"items": [{"bulto_id": bultos_otro[0], "codigo_esperado": "A", "codigo_leido": "A", "resultado": "INTACTO"}]},
        )
        self.assertEqual(res_batch.status_code, 403)

        # 5. Intentar cerrar remito de otra sucursal -> 403
        res_cerrar = client_local.post(f"/api/logistica/remitos/{remito_otro.numero}/cerrar")
        self.assertEqual(res_cerrar.status_code, 403)

    def test_alcance_administrador_acceso_total(self) -> None:
        """Administrador tiene acceso y operación total sobre cualquier sucursal (FR-036 / SC-018)."""
        _, remito_otro, bultos_otro = self._crear_y_despachar_remito("REM-PERM-03", OTRO_LOCAL_ID)
        client_admin = self._crear_cliente_autenticado("admin@stocky.local", "admin123")

        # 1. Admin puede filtrar por OTRO_LOCAL_ID
        res_listar = client_admin.get("/api/logistica/remitos", params={"destino_id": OTRO_LOCAL_ID})
        self.assertEqual(res_listar.status_code, 200)

        # 2. Admin puede recibir remito de OTRO_LOCAL_ID
        res_recibir = client_admin.post(f"/api/logistica/remitos/{remito_otro.numero}/recibir")
        self.assertEqual(res_recibir.status_code, 200)

        # 3. Admin puede verificar bultos de OTRO_LOCAL_ID
        res_verificar = client_admin.post(
            f"/api/logistica/bultos/{bultos_otro[0]}/verificar",
            json={
                "codigo_esperado": "PR-REM-PERM-03-01",
                "codigo_leido": "PR-REM-PERM-03-01",
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )
        self.assertEqual(res_verificar.status_code, 200)

    # =========================================================================
    # 5. Búsqueda global y trazabilidad (T061)
    # =========================================================================

    def test_busqueda_global_y_trazabilidad_consolidada(self) -> None:
        """Búsqueda global y trazabilidad consolidada del remito con auditoría completa (T061)."""
        orden, remito, bulto_ids = self._crear_y_despachar_remito("REM-TRAZ-01", LOCAL_ID)
        client = self._crear_cliente_autenticado("operador_local@stocky.local")

        # Recibir y verificar un bulto
        client.post(f"/api/logistica/remitos/{remito.numero}/recibir")
        client.post(
            f"/api/logistica/bultos/{bulto_ids[0]}/verificar",
            json={
                "codigo_esperado": "PR-REM-TRAZ-01-01",
                "codigo_leido": "PR-REM-TRAZ-01-01",
                "resultado": "INTACTO",
                "motivo_rechazo": "",
            },
        )

        # 1. Búsqueda global por término
        # Por ID de orden
        res_o = client.get(f"/api/logistica/trazabilidad/buscar?termino={orden.id}")
        self.assertEqual(res_o.status_code, 200)
        self.assertTrue(any(o["id"] == orden.id for o in res_o.json()["ordenes"]))

        # Por número de remito
        res_r = client.get(f"/api/logistica/trazabilidad/buscar?termino=REM-TRAZ-01")
        self.assertEqual(res_r.status_code, 200)
        self.assertTrue(any(r["numero"] == "REM-TRAZ-01" for r in res_r.json()["remitos"]))

        # Por ID de bulto
        res_b = client.get(f"/api/logistica/trazabilidad/buscar?termino={bulto_ids[0]}")
        self.assertEqual(res_b.status_code, 200)
        self.assertTrue(any(b["id"] == bulto_ids[0] for b in res_b.json()["bultos"]))

        # Por código de precinto
        res_p = client.get("/api/logistica/trazabilidad/buscar?termino=PR-REM-TRAZ-01-01")
        self.assertEqual(res_p.status_code, 200)
        self.assertTrue(any(b["codigo_precinto"] == "PR-REM-TRAZ-01-01" for b in res_p.json()["bultos"]))

        # 2. Trazabilidad consolidada del remito
        res_consolidada = client.get(f"/api/logistica/trazabilidad/remitos/{remito.numero}")
        self.assertEqual(res_consolidada.status_code, 200)
        traz = res_consolidada.json()

        self.assertEqual(traz["numero"], remito.numero)
        self.assertEqual(traz["orden_id"], orden.id)
        self.assertEqual(traz["origen_id"], CD_ID)
        self.assertEqual(traz["destino_id"], LOCAL_ID)
        self.assertIsNotNone(traz["orden"])
        self.assertEqual(traz["orden"]["id"], orden.id)

        # Bultos y controles asociados
        self.assertEqual(len(traz["bultos"]), 2)
        bulto_verif = next(b for b in traz["bultos"] if b["id"] == bulto_ids[0])
        self.assertEqual(bulto_verif["estado"], "VERIFICADO")
        self.assertEqual(bulto_verif["precinto_esperado"], "PR-REM-TRAZ-01-01")
        self.assertEqual(bulto_verif["resultado_control"], "VERIFICADO")

        # Controles de precinto registrados
        self.assertEqual(len(traz["controles_precintos"]), 1)
        self.assertEqual(traz["controles_precintos"][0]["bulto_id"], bulto_ids[0])
        self.assertEqual(traz["controles_precintos"][0]["resultado"], "VERIFICADO")

        # Eventos temporales acumulados
        eventos = traz["eventos_trazabilidad"]
        self.assertGreater(len(eventos), 0)
        acciones = [e["accion"] for e in eventos]
        self.assertIn("CREAR_ORDEN", acciones)
        self.assertIn("APROBACION", acciones)
        self.assertIn("CONTROL_PRECINTO", acciones)


if __name__ == "__main__":
    import unittest
    unittest.main()
