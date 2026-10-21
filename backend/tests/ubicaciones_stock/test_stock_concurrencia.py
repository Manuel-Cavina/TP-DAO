"""Cambiar el nivel mínimo mientras se vende no pisa las cantidades del stock (regresión).

Cada "petición" es una sesión propia sobre el mismo SQLite en archivo, como en la app real.
"""

from concurrent.futures import ThreadPoolExecutor
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
from modules.catalogo.application import Categoria_Service, Producto_Service, Proveedor_Service
from modules.ubicaciones_stock.application import Stock_Service, Ubicacion_Service

ESPERA_DEL_OTRO = 0.3


class TestConcurrenciaStock(unittest.TestCase):
    def setUp(self) -> None:
        self._temp_dir = tempfile.TemporaryDirectory()
        url = f"sqlite:///{(Path(self._temp_dir.name) / 'stock.sqlite3').as_posix()}"
        self.engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 10})
        cargar_modelos()
        Base.metadata.create_all(self.engine)
        self.producto_id, self.local_id = self._en_peticion_actual(self._cargar_datos)

    def tearDown(self) -> None:
        self.engine.dispose()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    def _cargar_datos(self) -> tuple[int, int]:
        ubicaciones = Ubicacion_Service()
        ubicaciones.crear_centro_distribucion("CD", "Ruta 9")
        local = ubicaciones.crear_local("Centro", "San Martín 1")
        categoria = Categoria_Service().crear("Bebidas")
        proveedor = Proveedor_Service().crear("20123456789", "Prov SA", "1", "p@prov.com")
        producto = Producto_Service(Stock_Service(observadores=[])).crear(
            "AGUA", "Agua", Decimal("100"), Decimal("50"), categoria.id, proveedor.id, 1
        )
        stock = Stock_Service(observadores=[])
        stock.registrar_en_transito(producto.id, local.id, 10)
        stock.acreditar_verificado(producto.id, local.id, 10)
        return producto.id, local.id

    def _en_peticion_actual(self, operacion):
        sesion = Session(self.engine)
        token = Request_Session_Context.establecer_sesion(sesion)
        try:
            resultado = operacion()
            sesion.commit()
            return resultado
        finally:
            Request_Session_Context.restablecer(token)
            sesion.close()

    def test_cambio_de_minimo_espera_a_la_venta_y_no_pisa_lo_vendido(self) -> None:
        sesion = Session(self.engine)
        token = Request_Session_Context.establecer_sesion(sesion)
        try:
            Stock_Service(observadores=[]).descontar_por_venta(self.producto_id, self.local_id, 4)

            otra = ThreadPoolExecutor(max_workers=1).submit(
                self._en_peticion_actual,
                lambda: Stock_Service(observadores=[]).actualizar_nivel_minimo(self.producto_id, self.local_id, 3),
            )
            time.sleep(ESPERA_DEL_OTRO)
            self.assertFalse(otra.done(), "El cambio de mínimo debe esperar el lock de la venta.")
            sesion.commit()
        finally:
            Request_Session_Context.restablecer(token)
            sesion.close()

        self.assertEqual(otra.result(timeout=5).cantidad_disponible, 6)
        final = self._en_peticion_actual(
            lambda: Stock_Service(observadores=[]).consultar_stock(self.producto_id, self.local_id)
        )
        self.assertEqual((final.cantidad_disponible, final.nivel_minimo_existencia), (6, 3))


if __name__ == "__main__":
    unittest.main()
