"""Pruebas del engine, sesiones y transacción HTTP transversal."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from bootstrap.application_factory import Application_Factory
from config.api.database_session_middleware import Database_Session_Middleware
from config.api.exception_handlers import registrar_manejadores_excepciones
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.legacy_sqlite import sqlite_connection
from config.database.request_session_context import Request_Session_Context
from errors.persistence_error import Persistencia_Exception
from modules.seguridad.application import Auth_Service


class Tracking_Session(Session):
    """Sesión de prueba que permite verificar el cierre garantizado."""

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.cierres = 0

    def close(self) -> None:
        self.cierres += 1
        super().close()


class Tracking_Session_Factory:
    """Factory instrumentada, compatible con el contrato del middleware."""

    def __init__(self, bind: object) -> None:
        self._bind = bind
        self.sesiones: list[Tracking_Session] = []

    def crear_sesion(self) -> Tracking_Session:
        sesion = Tracking_Session(bind=self._bind)
        self.sesiones.append(sesion)
        return sesion


class DatabaseLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temporal = tempfile.TemporaryDirectory()
        archivo = Path(self._temporal.name) / "erp_test.sqlite3"
        self.url = f"sqlite:///{archivo.as_posix()}"
        self.engine = Database_Engine_Singleton.obtener_instancia(self.url)
        with self.engine.begin() as conexion:
            conexion.execute(text("CREATE TABLE pruebas_transaccion (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL)"))

    def tearDown(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temporal.cleanup()

    def test_singleton_reutiliza_engine_y_session_factory(self) -> None:
        engine_repetido = Database_Engine_Singleton.obtener_instancia(self.url)
        self.assertIs(self.engine, engine_repetido)
        self.assertIs(
            Database_Engine_Singleton.obtener_session_factory(),
            Database_Engine_Singleton.obtener_session_factory(),
        )

    def test_session_factory_crea_una_sesion_nueva_por_invocacion(self) -> None:
        factory = Database_Engine_Singleton.obtener_session_factory()
        primera = factory.crear_sesion()
        segunda = factory.crear_sesion()
        try:
            self.assertIsNot(primera, segunda)
        finally:
            primera.close()
            segunda.close()

    def test_engine_sqlite_habilita_claves_foraneas_en_cada_conexion(self) -> None:
        with self.engine.connect() as primera, self.engine.connect() as segunda:
            self.assertEqual(primera.execute(text("PRAGMA foreign_keys")).scalar_one(), 1)
            self.assertEqual(segunda.execute(text("PRAGMA foreign_keys")).scalar_one(), 1)

    def test_middleware_usa_una_sesion_por_request_y_limpia_contexto(self) -> None:
        factory = Tracking_Session_Factory(self.engine)
        app = FastAPI()
        app.add_middleware(Database_Session_Middleware, session_factory=factory)
        sesiones_vistas: list[Session] = []

        @app.get("/sesion")
        def obtener_sesion() -> dict[str, bool]:
            primera = Request_Session_Context.obtener_sesion()
            segunda = Request_Session_Context.obtener_sesion()
            sesiones_vistas.append(primera)
            return {"misma_sesion": primera is segunda}

        cliente = TestClient(app)
        self.assertEqual(cliente.get("/sesion").json(), {"misma_sesion": True})
        self.assertEqual(cliente.get("/sesion").json(), {"misma_sesion": True})
        self.assertIsNot(sesiones_vistas[0], sesiones_vistas[1])
        self.assertEqual([sesion.cierres for sesion in factory.sesiones], [1, 1])
        with self.assertRaises(RuntimeError):
            Request_Session_Context.obtener_sesion()

    def test_middleware_confirma_escritura_en_respuesta_exitosa(self) -> None:
        app = self._crear_app_transaccional()

        @app.post("/ok", status_code=201)
        def escribir() -> dict[str, str]:
            Request_Session_Context.obtener_sesion().execute(
                text("INSERT INTO pruebas_transaccion (nombre) VALUES ('confirmado')")
            )
            return {"estado": "ok"}

        self.assertEqual(TestClient(app).post("/ok").status_code, 201)
        with self.engine.connect() as conexion:
            self.assertEqual(conexion.execute(text("SELECT count(*) FROM pruebas_transaccion")).scalar_one(), 1)

    def test_middleware_revierte_escritura_en_respuesta_http_de_error(self) -> None:
        app = self._crear_app_transaccional()

        @app.post("/error-controlado")
        def error_controlado() -> None:
            Request_Session_Context.obtener_sesion().execute(
                text("INSERT INTO pruebas_transaccion (nombre) VALUES ('revertido')")
            )
            raise HTTPException(status_code=409, detail="conflicto")

        self.assertEqual(TestClient(app).post("/error-controlado").status_code, 409)
        self._afirmar_tabla_vacia()

    def test_adaptador_heredado_comparte_transaccion_de_la_request(self) -> None:
        app = self._crear_app_transaccional()

        @app.post("/legado")
        def escritura_heredada() -> None:
            with sqlite_connection() as conexion:
                conexion.execute("INSERT INTO pruebas_transaccion (nombre) VALUES ('legado')")
            raise HTTPException(status_code=400, detail="regla incumplida")

        self.assertEqual(TestClient(app).post("/legado").status_code, 400)
        self._afirmar_tabla_vacia()

    def test_handler_persistencia_no_expone_detalle_tecnico(self) -> None:
        app = FastAPI()
        registrar_manejadores_excepciones(app)

        @app.get("/persistencia")
        def fallo_persistencia() -> None:
            raise Persistencia_Exception("UNIQUE constraint failed: ruta/interna.sqlite3")

        with self.assertLogs("config.api.exception_handlers", level="ERROR"):
            respuesta = TestClient(app, raise_server_exceptions=False).get("/persistencia")
        self.assertEqual(respuesta.status_code, 500)
        self.assertEqual(respuesta.json(), {"detail": "Error interno de persistencia."})

    def test_application_factory_inicializa_esquema_heredado_y_routers(self) -> None:
        app = Application_Factory.crear_aplicacion(self.url)
        cliente = TestClient(app)
        self.assertEqual(cliente.get("/api/catalogo/categorias").status_code, 401)
        sesion = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
        token = Request_Session_Context.establecer_sesion(sesion)
        try:
            Auth_Service().sembrar_identidades_defecto()
            sesion.commit()
        finally:
            Request_Session_Context.restablecer(token)
            sesion.close()
        login = cliente.post("/api/seguridad/login", json={"login": "admin@stocky.local", "password": "stocky-demo"})
        self.assertEqual(login.status_code, 200, login.text)
        respuesta = cliente.get("/api/catalogo/categorias")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), [])
        alta = cliente.post("/api/catalogo/categorias", json={"nombre": "Lácteos"})
        self.assertEqual(alta.status_code, 201)
        listado = cliente.get("/api/catalogo/categorias")
        self.assertEqual(listado.status_code, 200)
        self.assertEqual(listado.json()[0]["nombre"], "Lácteos")

    def test_application_factory_migra_remitos_heredados_sin_perder_su_orden(self) -> None:
        with self.engine.begin() as conexion:
            conexion.execute(
                text(
                    """
                    CREATE TABLE remitos (
                        numero VARCHAR(50) PRIMARY KEY,
                        origen_id INTEGER NOT NULL,
                        destino_id INTEGER NOT NULL,
                        fecha_emision DATETIME NOT NULL,
                        estado VARCHAR(20) NOT NULL
                    )
                    """
                )
            )
            conexion.execute(
                text(
                    """
                    CREATE TABLE bultos (
                        id INTEGER PRIMARY KEY,
                        orden_id INTEGER NOT NULL,
                        remito_numero VARCHAR(50)
                    )
                    """
                )
            )
            conexion.execute(
                text("INSERT INTO remitos VALUES ('REM-LEGADO', 1, 2, CURRENT_TIMESTAMP, 'EMITIDO')")
            )
            conexion.execute(text("INSERT INTO bultos VALUES (1, 42, 'REM-LEGADO')"))

        Application_Factory.crear_aplicacion(self.url)
        with self.engine.connect() as conexion:
            columnas = {fila[1] for fila in conexion.execute(text("PRAGMA table_info(remitos)"))}
            orden_id = conexion.execute(
                text("SELECT orden_id FROM remitos WHERE numero = 'REM-LEGADO'")
            ).scalar_one()
            indices = {fila[1] for fila in conexion.execute(text("PRAGMA index_list(remitos)"))}

        self.assertIn("orden_id", columnas)
        self.assertEqual(orden_id, 42)
        self.assertIn("ix_remitos_orden_id", indices)

        # La segunda inicialización no vuelve a alterar el esquema ni borra datos.
        Application_Factory.crear_aplicacion(self.url)

    def test_middleware_revierte_escritura_ante_excepcion_y_cierra_sesion(self) -> None:
        factory = Tracking_Session_Factory(self.engine)
        app = FastAPI()
        app.add_middleware(Database_Session_Middleware, session_factory=factory)

        @app.exception_handler(RuntimeError)
        async def manejar_error(_request: object, _error: RuntimeError) -> JSONResponse:
            return JSONResponse(status_code=500, content={"detail": "interno"})

        @app.post("/error")
        def error_inesperado() -> None:
            Request_Session_Context.obtener_sesion().execute(
                text("INSERT INTO pruebas_transaccion (nombre) VALUES ('revertido')")
            )
            raise RuntimeError("fallo")

        respuesta = TestClient(app, raise_server_exceptions=False).post("/error")
        self.assertEqual(respuesta.status_code, 500)
        self._afirmar_tabla_vacia()
        self.assertEqual(factory.sesiones[0].cierres, 1)
        with self.assertRaises(RuntimeError):
            Request_Session_Context.obtener_sesion()

    def _crear_app_transaccional(self) -> FastAPI:
        app = FastAPI()
        app.add_middleware(
            Database_Session_Middleware,
            session_factory=Database_Engine_Singleton.obtener_session_factory(),
        )
        return app

    def _afirmar_tabla_vacia(self) -> None:
        with self.engine.connect() as conexion:
            self.assertEqual(conexion.execute(text("SELECT count(*) FROM pruebas_transaccion")).scalar_one(), 0)


if __name__ == "__main__":
    unittest.main()
