"""Pruebas automatizadas de la API y lógica de seguridad (T009)."""

from datetime import datetime, timedelta
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "src"))

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from modules.seguridad.api.dependencies import COOKIE_NAME
from modules.seguridad.application.auth_service import Auth_Service
from modules.seguridad.domain.usuario import (
    ROL_ADMIN,
    ROL_OPERADOR,
    Asignacion_Operador,
    Usuario,
)
from modules.seguridad.infrastructure.seguridad_repository import Seguridad_Repository


class Test_Auth_API(unittest.TestCase):
    """Casos de prueba para login, logout, expiración, revocación, CSRF y roles."""

    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._temp_dir.name) / "test_seguridad.sqlite3"
        self.db_url = f"sqlite:///{self.db_path.as_posix()}"
        self.app = Application_Factory.crear_aplicacion(database_url=self.db_url)
        self.client = TestClient(self.app)
        self.engine = Database_Engine_Singleton.obtener_instancia(self.db_url)
        self._cargar_usuarios_prueba()

    def tearDown(self) -> None:
        if hasattr(self, "client"):
            self.client.close()
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def _ejecutar_en_sesion(self, accion):
        """Ejecuta una función dentro de una sesión ORM con contexto publicado."""
        with Session(self.engine) as session:
            token = Request_Session_Context.establecer_sesion(session)
            try:
                resultado = accion(session)
                session.commit()
                return resultado
            finally:
                Request_Session_Context.restablecer(token)

    def _cargar_usuarios_prueba(self) -> None:
        """Crea un usuario ADMIN y un OPERADOR para pruebas."""
        def _crear(_session: Session) -> None:
            repo = Seguridad_Repository()
            admin = Usuario(
                nombre="Admin Test",
                login="admin@test.local",
                password_hash=Auth_Service.hashear_password("admin123"),
                rol=ROL_ADMIN,
                activo=True,
            )
            repo.guardar_usuario(admin)

            asignacion = Asignacion_Operador(
                reporting_cd_id=1,
                authorised_branch_ids=[2, 3],
                shift_label="Mañana",
                activo=True,
            )
            operador = Usuario(
                nombre="Operador Test",
                login="operador@test.local",
                password_hash=Auth_Service.hashear_password("operador123"),
                rol=ROL_OPERADOR,
                activo=True,
                asignacion=asignacion,
            )
            repo.guardar_usuario(operador)

            inactivo = Usuario(
                nombre="Inactivo Test",
                login="inactivo@test.local",
                password_hash=Auth_Service.hashear_password("inactivo123"),
                rol=ROL_OPERADOR,
                activo=False,
            )
            repo.guardar_usuario(inactivo)

        self._ejecutar_en_sesion(_crear)

    def test_login_valido_setea_cookie_y_devuelve_payload(self) -> None:
        resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["user"]["login"], "admin@test.local")
        self.assertEqual(data["user"]["role"], "ADMIN")
        self.assertTrue(len(data["csrf_token"]) > 10)
        self.assertIn(COOKIE_NAME, resp.cookies)

    def test_login_credenciales_invalidas(self) -> None:
        # Password errónea
        resp1 = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "password_erronea"},
        )
        self.assertEqual(resp1.status_code, 401)

        # Usuario inexistente
        resp2 = self.client.post(
            "/api/seguridad/login",
            json={"login": "inexistente@test.local", "password": "admin123"},
        )
        self.assertEqual(resp2.status_code, 401)

    def test_login_usuario_inactivo_es_rechazado(self) -> None:
        resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "inactivo@test.local", "password": "inactivo123"},
        )
        self.assertEqual(resp.status_code, 403)

    def test_me_autenticado_con_cookie(self) -> None:
        login_resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "operador@test.local", "password": "operador123"},
        )
        self.assertEqual(login_resp.status_code, 200)

        me_resp = self.client.get("/api/seguridad/me")
        self.assertEqual(me_resp.status_code, 200)
        datos = me_resp.json()
        self.assertEqual(datos["user"]["login"], "operador@test.local")
        self.assertEqual(datos["user"]["role"], "OPERADOR")
        self.assertEqual(datos["scope"]["reporting_cd_id"], 1)
        self.assertEqual(datos["scope"]["branch_ids"], [2, 3])

    def test_me_autenticado_con_bearer_token(self) -> None:
        login_resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        token = login_resp.cookies[COOKIE_NAME]

        # Cliente sin cookies automáticas
        cliente_limpio = TestClient(self.app)
        me_resp = cliente_limpio.get(
            "/api/seguridad/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["user"]["login"], "admin@test.local")

    def test_me_sin_autenticacion_devuelve_401(self) -> None:
        resp = self.client.get("/api/seguridad/me")
        self.assertEqual(resp.status_code, 401)

    def test_logout_revoca_sesion_y_limpia_cookie(self) -> None:
        login_resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        self.assertEqual(login_resp.status_code, 200)

        logout_resp = self.client.post("/api/seguridad/logout")
        self.assertEqual(logout_resp.status_code, 200)

        # La consulta siguiente debe dar 401 porque fue revocada
        me_resp = self.client.get("/api/seguridad/me")
        self.assertEqual(me_resp.status_code, 401)

    def test_sesion_expirada_devuelve_401(self) -> None:
        login_resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        token = login_resp.cookies[COOKIE_NAME]

        # Forzar fecha de expiración en el pasado
        def _expirar(_session: Session) -> None:
            token_hash = Auth_Service._calcular_token_hash(token)
            from modules.seguridad.infrastructure.models import Sesion_Model
            from sqlalchemy import select
            sesion_model = _session.scalar(select(Sesion_Model).where(Sesion_Model.token_hash == token_hash))
            sesion_model.expira_en = datetime.now() - timedelta(minutes=5)

        self._ejecutar_en_sesion(_expirar)

        me_resp = self.client.get("/api/seguridad/me")
        self.assertEqual(me_resp.status_code, 401)

    def test_validacion_csrf_en_mutacion(self) -> None:
        login_resp = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        csrf_token = login_resp.json()["csrf_token"]

        # Sin CSRF en mutación -> 403
        resp_sin_csrf = self.client.post("/api/seguridad/mutacion-protegida")
        self.assertEqual(resp_sin_csrf.status_code, 403)

        # Con CSRF inválido -> 403
        resp_csrf_malo = self.client.post(
            "/api/seguridad/mutacion-protegida",
            headers={"X-CSRF-Token": "token-falso-invalido"},
        )
        self.assertEqual(resp_csrf_malo.status_code, 403)

        # Con CSRF correcto -> 200
        resp_csrf_ok = self.client.post(
            "/api/seguridad/mutacion-protegida",
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(resp_csrf_ok.status_code, 200)
        self.assertTrue(resp_csrf_ok.json()["ok"])

    def test_requerir_rol_autorizaciones_y_rechazos(self) -> None:
        # Operador no puede acceder a endpoint ADMIN
        self.client.post(
            "/api/seguridad/login",
            json={"login": "operador@test.local", "password": "operador123"},
        )
        resp_admin = self.client.get("/api/seguridad/admin-only")
        self.assertEqual(resp_admin.status_code, 403)

        # Operador sí puede acceder a endpoint OPERADOR
        resp_op = self.client.get("/api/seguridad/operador-only")
        self.assertEqual(resp_op.status_code, 200)

        # Admin puede acceder a endpoint ADMIN
        self.client.post("/api/seguridad/logout")
        self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        resp_admin_propio = self.client.get("/api/seguridad/admin-only")
        self.assertEqual(resp_admin_propio.status_code, 200)

        # Admin hereda acceso total: puede acceder a endpoint OPERADOR
        resp_admin_hereda = self.client.get("/api/seguridad/operador-only")
        self.assertEqual(resp_admin_hereda.status_code, 200)

    def test_ventas_caja_y_reportes_requieren_admin(self) -> None:
        rutas_protegidas = (
            "/api/ventas",
            "/api/caja/1?desde=2026-01-01&hasta=2026-01-01",
            "/api/reportes/existencias",
        )
        for ruta in rutas_protegidas:
            with self.subTest(sesion="ausente", ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 401)

        self.client.post(
            "/api/seguridad/login",
            json={"login": "operador@test.local", "password": "operador123"},
        )
        for ruta in rutas_protegidas:
            with self.subTest(rol="OPERADOR", ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 403)
        self.assertEqual(self.client.get("/api/logistica/ordenes").status_code, 200)

        self.client.post("/api/seguridad/logout")
        self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        for ruta, estado in zip(rutas_protegidas, (200, 404, 200), strict=True):
            with self.subTest(rol="ADMIN", ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, estado)
        self.assertEqual(self.client.get("/api/logistica/ordenes").status_code, 200)

    def test_sembrar_identidades_defecto_es_idempotente(self) -> None:
        def _sembrar(_session: Session) -> dict[str, int]:
            service = Auth_Service()
            res1 = service.sembrar_identidades_defecto()
            # Segunda ejecución idempotente
            res2 = service.sembrar_identidades_defecto()
            return {"r1": res1, "r2": res2}

        self._ejecutar_en_sesion(_sembrar)

        # Verificar que admin@stocky.local y operador@stocky.local pueden loguearse
        resp_admin = self.client.post(
            "/api/seguridad/login",
            json={"login": "admin@stocky.local", "password": "stocky-demo"},
        )
        self.assertEqual(resp_admin.status_code, 200)
        self.assertEqual(resp_admin.json()["user"]["role"], "ADMIN")

        resp_op = self.client.post(
            "/api/seguridad/login",
            json={"login": "operador@stocky.local", "password": "stocky-demo"},
        )
        self.assertEqual(resp_op.status_code, 200)
        self.assertEqual(resp_op.json()["user"]["role"], "OPERADOR")

    def test_alias_rutas_api_auth(self) -> None:
        resp = self.client.post(
            "/api/auth/login",
            json={"login": "admin@test.local", "password": "admin123"},
        )
        self.assertEqual(resp.status_code, 200)

        me_resp = self.client.get("/api/auth/me")
        self.assertEqual(me_resp.status_code, 200)

        logout_resp = self.client.post("/api/auth/logout")
        self.assertEqual(logout_resp.status_code, 200)
