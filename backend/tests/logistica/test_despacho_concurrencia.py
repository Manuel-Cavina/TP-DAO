"""Dos peticiones simultáneas no despachan dos veces el mismo remito (P5, V1).

Cada "petición" es una sesión propia sobre el mismo SQLite en archivo, como en la app real.
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fakes_logistica import Fake_Stock_Logistica
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from config.database.base import Base
from config.database.model_registry import cargar_modelos
from config.database.request_session_context import Request_Session_Context
from modules.logistica.application import Despacho_Service, Empaquetado_Service, Reposicion_Service
from modules.logistica.domain.exceptions import Remito_Incompleto_Exception

CD_ID = 1
LOCAL_ID = 2
PRODUCTO_A = 1
ESPERA_DEL_OTRO = 0.3


def _stock_fake() -> Fake_Stock_Logistica:
    return Fake_Stock_Logistica(
        centros={CD_ID}, locales={LOCAL_ID}, productos={PRODUCTO_A}, stock_cd={(PRODUCTO_A, CD_ID): 100}
    )


class TestConcurrenciaDespacho(unittest.TestCase):
    def setUp(self) -> None:
        self._temp_dir = tempfile.TemporaryDirectory()
        url = f"sqlite:///{(Path(self._temp_dir.name) / 'despacho.sqlite3').as_posix()}"
        self.engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 10})
        cargar_modelos()
        Base.metadata.create_all(self.engine)
        self._armar_remito_emitido()

    def tearDown(self) -> None:
        self.engine.dispose()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def _armar_remito_emitido(self) -> None:
        sesion, token = self._abrir_peticion()
        try:
            sesion.execute(
                text(
                    "INSERT INTO ubicaciones (id, tipo, nombre, direccion, activo) VALUES "
                    "(1, 'CD', 'CD Central', 'Ruta 9', 1), (2, 'LOCAL', 'Local Centro', 'San Martín 100', 1)"
                )
            )
            stock = _stock_fake()
            orden = Reposicion_Service(stock).crear_orden_manual(
                CD_ID, LOCAL_ID, [{"producto_id": PRODUCTO_A, "cantidad": 5}]
            )
            empaquetado = Empaquetado_Service(stock)
            bulto = empaquetado.crear_bulto(orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 5}])
            empaquetado.registrar_precinto("PREC-1")
            empaquetado.precintar_bulto(bulto.id, "PREC-1")
            empaquetado.aprobar_bulto(bulto.id)
            empaquetado.generar_remito("REM-1", orden.id, [bulto.id])
            sesion.commit()
        finally:
            self._cerrar_peticion(sesion, token)

    def _en_otra_peticion(self, operacion):
        """Ejecuta la operación en otro hilo, con su propia sesión publicada en el contexto."""

        def correr():
            sesion = Session(self.engine)
            token = Request_Session_Context.establecer_sesion(sesion)
            try:
                resultado = operacion()
                sesion.commit()
                return resultado
            finally:
                Request_Session_Context.restablecer(token)
                sesion.close()

        return ThreadPoolExecutor(max_workers=1).submit(correr)

    def _abrir_peticion(self) -> tuple[Session, object]:
        sesion = Session(self.engine)
        return sesion, Request_Session_Context.establecer_sesion(sesion)

    def _cerrar_peticion(self, sesion: Session, token: object) -> None:
        Request_Session_Context.restablecer(token)
        sesion.close()

    def test_segundo_despacho_simultaneo_ve_el_remito_ya_despachado(self) -> None:
        """Regresion: el despacho toma el lock de escritura antes de leer el estado del remito."""
        primer_stock, segundo_stock = _stock_fake(), _stock_fake()
        sesion, token = self._abrir_peticion()
        try:
            remito = Despacho_Service(primer_stock).despachar_remito("REM-1")

            futuro = self._en_otra_peticion(lambda: Despacho_Service(segundo_stock).despachar_remito("REM-1"))
            time.sleep(ESPERA_DEL_OTRO)
            self.assertFalse(futuro.done(), "El segundo despacho debe esperar el lock del primero.")

            sesion.commit()
        finally:
            self._cerrar_peticion(sesion, token)

        self.assertEqual(remito.estado, "DESPACHADO")
        with self.assertRaises(Remito_Incompleto_Exception):
            futuro.result(timeout=5)
        self.assertEqual(len(primer_stock.operaciones), 1)
        self.assertEqual(segundo_stock.operaciones, [])


if __name__ == "__main__":
    unittest.main()
