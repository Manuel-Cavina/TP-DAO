from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from config.database.base import Base
from config.database.request_session_context import Request_Session_Context
from modules.ubicaciones_stock.application.stock_service import Stock_Service
from modules.ubicaciones_stock.application.ubicacion_service import Ubicacion_Service
from modules.ubicaciones_stock.domain.exceptions import Datos_Invalidos_Exception, Ubicacion_Con_Stock_Exception
from modules.ubicaciones_stock.domain.stock import Stock
from modules.ubicaciones_stock.dto import Crear_CD_DTO, Crear_Local_DTO
from modules.ubicaciones_stock.infrastructure.stock_repository import Stock_Repository
from modules.ubicaciones_stock.infrastructure.ubicacion_repository import Ubicacion_Repository


class StockORMTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(bind=self.engine, autoflush=True, expire_on_commit=False)
        self.token = Request_Session_Context.establecer_sesion(self.session)
        self.ubicaciones = Ubicacion_Repository()
        self.stocks = Stock_Repository()
        self.ubicacion_service = Ubicacion_Service(self.ubicaciones)
        self.stock_service = Stock_Service(self.stocks, self.ubicaciones)

    def tearDown(self) -> None:
        Request_Session_Context.restablecer(self.token)
        self.session.close()
        self.engine.dispose()

    def _crear_cd_y_local(self):
        cd = self.ubicacion_service.crear_centro_distribucion(Crear_CD_DTO("CD", "Ruta 1"))
        local = self.ubicacion_service.crear_local(Crear_Local_DTO("Local", "Av. 1", "111"))
        return cd, local

    def test_repositorios_usan_sesion_de_request(self) -> None:
        cd, local = self._crear_cd_y_local()
        self.stock_service.inicializar_stock_para_producto(1, 10)
        stocks = self.stocks.listar_por_producto(1)
        self.assertEqual({stock.ubicacion_id for stock in stocks}, {cd.id, local.id})
        self.assertTrue(all(stock in self.session for stock in stocks))

    def test_flujo_logistico_y_ventas(self) -> None:
        cd, local = self._crear_cd_y_local()
        self.stock_service.ingresar_mercaderia_cd(1, cd.id, 100)
        self.stock_service.inicializar_stock_para_producto(1, 10)
        self.stock_service.reservar_para_despacho(1, cd.id, 40)
        self.stock_service.registrar_en_transito(1, local.id, 40)
        self.stock_service.acreditar_verificado(1, local.id, 30)
        self.stock_service.registrar_merma(1, local.id, 10)
        self.stock_service.descontar_por_venta(1, local.id, 5)
        self.stock_service.reingresar_por_devolucion(1, local.id, 2)
        self.assertEqual(self.stock_service.consultar_disponible(1, cd.id), 60)
        self.assertEqual(self.stock_service.consultar_disponible(1, local.id), 27)

    def test_ingreso_solo_permitido_en_cd_y_baja_con_stock_falla(self) -> None:
        cd, local = self._crear_cd_y_local()
        with self.assertRaises(Datos_Invalidos_Exception):
            self.stock_service.ingresar_mercaderia_cd(1, local.id, 1)
        self.stock_service.ingresar_mercaderia_cd(1, cd.id, 1)
        with self.assertRaises(Ubicacion_Con_Stock_Exception):
            self.ubicacion_service.dar_de_baja_ubicacion(cd.id)

    def test_observer_persiste_alerta_y_delega_reposicion(self) -> None:
        _, local = self._crear_cd_y_local()
        reposicion = MagicMock()
        servicio = Stock_Service(self.stocks, self.ubicaciones, reposicion)
        stock = self.stocks.crear(Stock(1, local.id, cantidad_disponible=6, nivel_minimo_existencia=5))
        servicio.descontar_por_venta(1, local.id, 1)
        self.assertEqual(len(self.stocks.listar_alertas()), 1)
        reposicion.registrar_necesidad.assert_called_once_with(producto_id=1, local_id=local.id, cantidad=5)
