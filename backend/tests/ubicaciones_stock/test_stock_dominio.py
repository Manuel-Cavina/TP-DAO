"""Stock y patrón Observer sin base de datos (Integrante 1)."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.ubicaciones_stock.application import Registro_Necesidad_Contract, Reposicion_Local_Observer
from modules.ubicaciones_stock.domain import Centro_Distribucion, Local, Stock, Stock_Observer, crear_ubicacion
from modules.ubicaciones_stock.domain.exceptions import (
    Cantidad_Invalida_Exception,
    Stock_Insuficiente_Exception,
    Ubicacion_Invalida_Exception,
)


class Observador_Espia(Stock_Observer):
    def __init__(self) -> None:
        self.avisos: list[int] = []

    def notificar_stock_bajo(self, stock: Stock) -> None:
        self.avisos.append(stock.cantidad_disponible)


class Registro_Espia(Registro_Necesidad_Contract):
    def __init__(self) -> None:
        self.necesidades: list[tuple[int, int, int]] = []

    def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self.necesidades.append((producto_id, local_id, cantidad))


class TestStock(unittest.TestCase):
    def setUp(self) -> None:
        self.stock = Stock(producto_id=1, ubicacion_id=2, nivel_minimo_existencia=3, cantidad_disponible=10, es_local=True)

    def test_movimientos_del_circuito_cd_local(self) -> None:
        self.stock.registrar_en_transito(5)
        self.stock.acreditar_desde_transito(3)
        self.stock.registrar_merma_transito(2)

        self.assertEqual((self.stock.cantidad_disponible, self.stock.cantidad_en_transito), (13, 0))

    def test_nunca_queda_negativo(self) -> None:
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.stock.descontar_disponible(11)
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.stock.acreditar_desde_transito(1)
        self.assertEqual(self.stock.cantidad_disponible, 10)

    def test_cantidades_y_minimo_deben_ser_positivos(self) -> None:
        for operacion in (
            lambda: self.stock.descontar_disponible(0),
            lambda: self.stock.incrementar_disponible(-1),
            lambda: self.stock.actualizar_nivel_minimo(0),
            lambda: Stock(1, 2, 1, cantidad_disponible=-1),
        ):
            with self.subTest(), self.assertRaises(Cantidad_Invalida_Exception):
                operacion()


class TestObserver(unittest.TestCase):
    def setUp(self) -> None:
        self.espia = Observador_Espia()
        self.stock = Stock(1, 2, nivel_minimo_existencia=3, cantidad_disponible=6, es_local=True)
        self.stock.agregar_observador(self.espia)

    def test_notifica_solo_al_quedar_en_o_bajo_el_minimo(self) -> None:
        self.stock.descontar_disponible(2)
        self.assertEqual(self.espia.avisos, [])

        self.stock.descontar_disponible(1)
        self.stock.descontar_disponible(1)
        self.assertEqual(self.espia.avisos, [3, 2])

    def test_incrementar_no_notifica(self) -> None:
        self.stock.descontar_disponible(5)
        self.stock.incrementar_disponible(1)

        self.assertEqual(self.espia.avisos, [1])

    def test_reposicion_local_sugiere_dos_veces_el_minimo_menos_disponible(self) -> None:
        registro = Registro_Espia()
        self.stock.agregar_observador(Reposicion_Local_Observer(registro))

        self.stock.descontar_disponible(5)

        self.assertEqual(registro.necesidades, [(1, 2, 5)])

    def test_el_cd_no_genera_necesidad_de_reposicion(self) -> None:
        registro = Registro_Espia()
        stock_cd = Stock(1, 1, nivel_minimo_existencia=3, cantidad_disponible=4, es_local=False)
        stock_cd.agregar_observador(Reposicion_Local_Observer(registro))

        stock_cd.descontar_disponible(2)

        self.assertEqual(registro.necesidades, [])


class TestUbicacion(unittest.TestCase):
    def test_jerarquia_y_fabrica(self) -> None:
        cd = crear_ubicacion("CD", nombre="CD", direccion="Ruta 9")
        local = crear_ubicacion("LOCAL", nombre="Centro", direccion="San Martín 1", telefono="  ")

        self.assertIsInstance(cd, Centro_Distribucion)
        self.assertIsInstance(local, Local)
        self.assertTrue(cd.es_centro_distribucion and local.es_local)
        self.assertIsNone(local.telefono)

    def test_datos_invalidos(self) -> None:
        for crear in (lambda: crear_ubicacion("DEPOSITO", nombre="X", direccion="Y"), lambda: Local("", "Y")):
            with self.subTest(), self.assertRaises(Ubicacion_Invalida_Exception):
                crear()


if __name__ == "__main__":
    unittest.main()
