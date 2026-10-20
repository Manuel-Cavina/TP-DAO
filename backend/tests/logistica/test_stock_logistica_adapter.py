"""Adaptador de stock de logistica sobre las tablas de Integrante 1 (V1: solo lo verificado es vendible)."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.logistica.infrastructure import Stock_Logistica_Adapter
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Ubicacion_No_Encontrada_Exception,
    Stock_Insuficiente_Exception,
)
from sqlite_logistica_test_case import (
    CD_ID,
    LOCAL_ID,
    PRODUCTO_A,
    PRODUCTO_B,
    PRODUCTO_INACTIVO,
    Sqlite_Test_Case,
)


class TestStockLogisticaAdapter(Sqlite_Test_Case):
    def setUp(self) -> None:
        super().setUp()
        self.cargar_datos_integrante_1({PRODUCTO_A: 10})
        self.adapter = Stock_Logistica_Adapter()

    def test_validaciones_de_ubicacion_y_producto(self) -> None:
        self.adapter.validar_centro_distribucion(CD_ID)
        self.adapter.validar_local(LOCAL_ID)
        self.adapter.validar_producto(PRODUCTO_A)

        for operacion in (
            lambda: self.adapter.validar_centro_distribucion(LOCAL_ID),
            lambda: self.adapter.validar_local(CD_ID),
            lambda: self.adapter.validar_local(99),
        ):
            with self.subTest(), self.assertRaises(Ubicacion_No_Encontrada_Exception):
                operacion()
        for producto in (PRODUCTO_INACTIVO, 99):
            with self.subTest(producto=producto), self.assertRaises(Producto_No_Encontrado_Exception):
                self.adapter.validar_producto(producto)

    def test_reservar_descuenta_del_cd_sin_pasarse(self) -> None:
        self.adapter.reservar_para_despacho(PRODUCTO_A, CD_ID, 4)
        self.assertEqual(self.stock(PRODUCTO_A, CD_ID), (6, 0))

        with self.assertRaises(Stock_Insuficiente_Exception):
            self.adapter.reservar_para_despacho(PRODUCTO_A, CD_ID, 7)
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.adapter.reservar_para_despacho(PRODUCTO_B, CD_ID, 1)
        self.assertEqual(self.stock(PRODUCTO_A, CD_ID), (6, 0))

    def test_transito_crea_el_registro_del_local_y_luego_acumula(self) -> None:
        self.assertIsNone(self.stock(PRODUCTO_A, LOCAL_ID))

        self.adapter.registrar_en_transito(PRODUCTO_A, LOCAL_ID, 3)
        self.adapter.registrar_en_transito(PRODUCTO_A, LOCAL_ID, 2)

        self.assertEqual(self.stock(PRODUCTO_A, LOCAL_ID), (0, 5))

    def test_acreditar_y_merma_mueven_solo_lo_que_esta_en_transito(self) -> None:
        self.adapter.registrar_en_transito(PRODUCTO_A, LOCAL_ID, 5)

        self.adapter.acreditar_verificado(PRODUCTO_A, LOCAL_ID, 3)
        self.adapter.registrar_merma(PRODUCTO_A, LOCAL_ID, 2)

        self.assertEqual(self.stock(PRODUCTO_A, LOCAL_ID), (3, 0))
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.adapter.acreditar_verificado(PRODUCTO_A, LOCAL_ID, 1)
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.adapter.registrar_merma(PRODUCTO_A, LOCAL_ID, 1)


if __name__ == "__main__":
    unittest.main()
