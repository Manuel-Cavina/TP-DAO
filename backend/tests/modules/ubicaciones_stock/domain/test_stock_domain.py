from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from modules.ubicaciones_stock.domain.exceptions import (
    Datos_Invalidos_Exception,
    Stock_Insuficiente_Exception,
)
from modules.ubicaciones_stock.domain.stock import Stock
from modules.ubicaciones_stock.domain.ubicacion import (
    Centro_Distribucion,
    Local,
    Ubicacion,
)


class StockDomainTests(unittest.TestCase):
    def test_creacion_centro_distribucion(self) -> None:
        cd = Centro_Distribucion(
            nombre="CD Central",
            direccion="Ruta 9 Km 40",
            telefono="0800-111-222",
            id=1,
        )
        self.assertEqual(cd.nombre, "CD Central")
        self.assertEqual(cd.tipo, "CD")
        self.assertTrue(cd.es_centro_distribucion())
        self.assertTrue(cd.activo)

    def test_creacion_local_valida_telefono(self) -> None:
        local = Local(
            nombre="Sucursal Palermo",
            direccion="Av. Santa Fe 3000",
            telefono="1144332211",
            id=2,
        )
        self.assertEqual(local.tipo, "LOCAL")
        self.assertFalse(local.es_centro_distribucion())

        with self.assertRaises(Datos_Invalidos_Exception):
            Local(nombre="Sucursal X", direccion="Calle 1", telefono="   ")

    def test_stock_operaciones_disponible(self) -> None:
        stock = Stock(
            producto_id=1,
            ubicacion_id=10,
            cantidad_disponible=50,
            cantidad_en_transito=0,
            nivel_minimo_existencia=20,
        )
        # Descontar
        stock.descontar_disponible(15)
        self.assertEqual(stock.cantidad_disponible, 35)

        # Insuficiente
        with self.assertRaises(Stock_Insuficiente_Exception):
            stock.descontar_disponible(100)

        # Incrementar
        stock.incrementar_disponible(25)
        self.assertEqual(stock.cantidad_disponible, 60)

    def test_stock_flujo_transito_y_verificacion(self) -> None:
        stock = Stock(
            producto_id=1,
            ubicacion_id=2,
            cantidad_disponible=10,
            cantidad_en_transito=0,
            nivel_minimo_existencia=15,
        )
        # 1. Pasa a tránsito
        stock.mover_a_transito(30)
        self.assertEqual(stock.cantidad_en_transito, 30)
        self.assertEqual(stock.cantidad_disponible, 10)

        # 2. Bulto verificado (10 unidades pasan a disponible)
        stock.acreditar_desde_transito(10)
        self.assertEqual(stock.cantidad_en_transito, 20)
        self.assertEqual(stock.cantidad_disponible, 20)

        # 3. Bulto rechazado / merma (20 unidades perdidas, no acreditan disponible)
        stock.registrar_merma_transito(20)
        self.assertEqual(stock.cantidad_en_transito, 0)
        self.assertEqual(stock.cantidad_disponible, 20)

    def test_stock_minimo_y_reposicion_sugerida(self) -> None:
        stock = Stock(
            producto_id=1,
            ubicacion_id=2,
            cantidad_disponible=25,
            cantidad_en_transito=0,
            nivel_minimo_existencia=20,
        )
        self.assertFalse(stock.esta_en_o_bajo_minimo())

        # Baja a nivel crítico
        stock.descontar_disponible(10)
        self.assertEqual(stock.cantidad_disponible, 15)
        self.assertTrue(stock.esta_en_o_bajo_minimo())

        # Fórmula: (20 * 2) - 15 = 25
        self.assertEqual(stock.calcular_reposicion_sugerida(), 25)


if __name__ == "__main__":
    unittest.main()
