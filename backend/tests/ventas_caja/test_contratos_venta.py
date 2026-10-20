from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fakes import Fake_Catalogo_Venta, Fake_Stock_Venta
from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Stock_No_Encontrado_Exception,
    Stock_Insuficiente_Exception,
)
from modules.ventas_caja.application.catalogo_venta_contract import Catalogo_Venta_Contract
from modules.ventas_caja.application.stock_venta_contract import Stock_Venta_Contract

PRODUCTO_ID = 1
LOCAL_ID = 10


class TestStockVentaContract(unittest.TestCase):
    def setUp(self) -> None:
        self.stock = Fake_Stock_Venta({(PRODUCTO_ID, LOCAL_ID): 5})

    def test_cumple_el_contrato(self) -> None:
        self.assertIsInstance(self.stock, Stock_Venta_Contract)

    def test_contrato_no_se_puede_instanciar(self) -> None:
        with self.assertRaises(TypeError):
            Stock_Venta_Contract()

    def test_consultar_disponible(self) -> None:
        self.assertEqual(self.stock.consultar_disponible(PRODUCTO_ID, LOCAL_ID), 5)

    def test_descontar_por_venta_resta_disponible(self) -> None:
        self.stock.descontar_por_venta(PRODUCTO_ID, LOCAL_ID, 3)

        self.assertEqual(self.stock.consultar_disponible(PRODUCTO_ID, LOCAL_ID), 2)
        self.assertEqual(self.stock.operaciones, [("DESCONTAR", PRODUCTO_ID, LOCAL_ID, 3)])

    def test_descontar_mas_de_lo_disponible_no_modifica_stock(self) -> None:
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.stock.descontar_por_venta(PRODUCTO_ID, LOCAL_ID, 6)

        self.assertEqual(self.stock.consultar_disponible(PRODUCTO_ID, LOCAL_ID), 5)
        self.assertEqual(self.stock.operaciones, [])

    def test_reingresar_por_devolucion_suma_disponible(self) -> None:
        self.stock.reingresar_por_devolucion(PRODUCTO_ID, LOCAL_ID, 2)

        self.assertEqual(self.stock.consultar_disponible(PRODUCTO_ID, LOCAL_ID), 7)

    def test_sin_registro_de_stock_equivale_a_cero(self) -> None:
        self.assertEqual(self.stock.consultar_disponible(PRODUCTO_ID, 99), 0)
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.stock.descontar_por_venta(PRODUCTO_ID, 99, 1)

    def test_reingresar_sin_registro_de_stock_lanza_error(self) -> None:
        with self.assertRaises(Stock_No_Encontrado_Exception):
            self.stock.reingresar_por_devolucion(PRODUCTO_ID, 99, 1)


class TestCatalogoVentaContract(unittest.TestCase):
    def setUp(self) -> None:
        self.catalogo = Fake_Catalogo_Venta({PRODUCTO_ID: Decimal("1500.50")})

    def test_cumple_el_contrato(self) -> None:
        self.assertIsInstance(self.catalogo, Catalogo_Venta_Contract)

    def test_obtener_precio_venta_devuelve_decimal(self) -> None:
        precio = self.catalogo.obtener_precio_venta(PRODUCTO_ID)

        self.assertEqual(precio, Decimal("1500.50"))
        self.assertIsInstance(precio, Decimal)

    def test_producto_inexistente_lanza_error(self) -> None:
        with self.assertRaises(Producto_No_Encontrado_Exception):
            self.catalogo.obtener_precio_venta(99)


if __name__ == "__main__":
    unittest.main()
