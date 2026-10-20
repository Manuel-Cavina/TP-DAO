"""Dos peticiones simultáneas no repiten comprobante ni superan lo comprado al devolver (V5).

Cada "petición" es una sesión propia sobre el mismo SQLite en archivo, como en la app real.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from decimal import Decimal
from pathlib import Path
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from config.database.base import Base
from config.database.model_registry import cargar_modelos
from config.database.request_session_context import Request_Session_Context
from modules.ventas_caja.domain import Pago_Efectivo, Venta
from modules.ventas_caja.infrastructure import Venta_Repository

LOCAL_ID = 2
ESPERA_DEL_OTRO = 0.3


class TestConcurrenciaVentas(unittest.TestCase):
    def setUp(self) -> None:
        self._temp_dir = tempfile.TemporaryDirectory()
        url = f"sqlite:///{(Path(self._temp_dir.name) / 'concurrencia.sqlite3').as_posix()}"
        self.engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 10})
        cargar_modelos()
        Base.metadata.create_all(self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

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

    def test_dos_ventas_simultaneas_no_repiten_numero(self) -> None:
        sesion, token = self._abrir_peticion()
        try:
            primero = Venta_Repository().siguiente_numero_comprobante(LOCAL_ID)

            futuro = self._en_otra_peticion(
                lambda: Venta_Repository().siguiente_numero_comprobante(LOCAL_ID)
            )
            time.sleep(ESPERA_DEL_OTRO)
            self.assertFalse(futuro.done(), "La segunda petición debe esperar el lock de la primera.")

            sesion.commit()
        finally:
            self._cerrar_peticion(sesion, token)

        self.assertEqual((primero, futuro.result(timeout=5)), (1, 2))

    def test_devolucion_espera_a_la_otra_devolucion_de_la_misma_venta(self) -> None:
        sesion, token = self._abrir_peticion()
        try:
            venta = Venta(LOCAL_ID, datetime(2026, 10, 1))
            venta.agregar_producto(1, 1, Decimal("10"))
            venta.confirmar(Pago_Efectivo(Decimal("10")), 1)
            venta_id = Venta_Repository().guardar(venta).id
            sesion.commit()

            Venta_Repository().obtener_para_devolucion(venta_id)
            futuro = self._en_otra_peticion(lambda: Venta_Repository().obtener_para_devolucion(venta_id))
            time.sleep(ESPERA_DEL_OTRO)
            self.assertFalse(futuro.done(), "La segunda devolución debe esperar el lock de la primera.")

            sesion.commit()
        finally:
            self._cerrar_peticion(sesion, token)

        self.assertEqual(futuro.result(timeout=5).id, venta_id)


if __name__ == "__main__":
    unittest.main()
