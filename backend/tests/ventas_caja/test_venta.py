from datetime import datetime
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.ventas_caja.domain.detalle_venta import Detalle_Venta
from modules.ventas_caja.domain.exceptions import Venta_Invalida_Exception
from modules.ventas_caja.domain.venta import Venta

LOCAL_ID = 10
FECHA = datetime(2026, 10, 19, 12, 30)


class TestDetalleVenta(unittest.TestCase):
    def test_calcula_subtotal(self) -> None:
        detalle = Detalle_Venta(producto_id=1, cantidad=3, precio_unitario=Decimal("100.50"))

        self.assertEqual(detalle.subtotal, Decimal("301.50"))

    def test_rechaza_cantidad_cero_o_negativa(self) -> None:
        for cantidad in (0, -2):
            with self.subTest(cantidad=cantidad), self.assertRaises(Venta_Invalida_Exception):
                Detalle_Venta(producto_id=1, cantidad=cantidad, precio_unitario=Decimal("10"))

    def test_rechaza_cantidad_no_entera(self) -> None:
        for cantidad in (1.5, True):
            with self.subTest(cantidad=cantidad), self.assertRaises(Venta_Invalida_Exception):
                Detalle_Venta(producto_id=1, cantidad=cantidad, precio_unitario=Decimal("10"))

    def test_rechaza_precio_float(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            Detalle_Venta(producto_id=1, cantidad=1, precio_unitario=10.0)

    def test_rechaza_precio_cero(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            Detalle_Venta(producto_id=1, cantidad=1, precio_unitario=Decimal("0"))

    def test_rechaza_producto_invalido(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            Detalle_Venta(producto_id=0, cantidad=1, precio_unitario=Decimal("10"))


class TestVenta(unittest.TestCase):
    def setUp(self) -> None:
        self.venta = Venta(local_id=LOCAL_ID, fecha_hora=FECHA)

    def test_venta_nueva_no_tiene_detalles_ni_total(self) -> None:
        self.assertEqual(self.venta.detalles, ())
        self.assertEqual(self.venta.total, Decimal("0"))

    def test_total_es_la_suma_de_los_subtotales(self) -> None:
        self.venta.agregar_producto(1, 2, Decimal("100.00"))
        self.venta.agregar_producto(2, 1, Decimal("49.99"))

        self.assertEqual(self.venta.total, Decimal("249.99"))
        self.assertEqual(len(self.venta.detalles), 2)

    def test_mismo_producto_se_unifica_en_una_linea(self) -> None:
        self.venta.agregar_producto(1, 2, Decimal("100.00"))
        self.venta.agregar_producto(1, 3, Decimal("100.00"))

        self.assertEqual(len(self.venta.detalles), 1)
        self.assertEqual(self.venta.detalles[0].cantidad, 5)
        self.assertEqual(self.venta.total, Decimal("500.00"))

    def test_mismo_producto_con_otro_precio_se_rechaza(self) -> None:
        self.venta.agregar_producto(1, 2, Decimal("100.00"))

        with self.assertRaises(Venta_Invalida_Exception):
            self.venta.agregar_producto(1, 1, Decimal("90.00"))
        self.assertEqual(self.venta.detalles[0].cantidad, 2)

    def test_linea_invalida_no_modifica_la_venta(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            self.venta.agregar_producto(1, 0, Decimal("100.00"))

        self.assertEqual(self.venta.detalles, ())

    def test_detalles_no_se_pueden_modificar_desde_afuera(self) -> None:
        self.venta.agregar_producto(1, 1, Decimal("10"))

        with self.assertRaises(AttributeError):
            self.venta.detalles.append(Detalle_Venta(2, 1, Decimal("10")))
        with self.assertRaises(AttributeError):
            self.venta.total = Decimal("1")

    def test_validar_tiene_detalles(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            self.venta.validar_tiene_detalles()

        self.venta.agregar_producto(1, 1, Decimal("10"))
        self.venta.validar_tiene_detalles()

    def test_id_se_asigna_una_sola_vez(self) -> None:
        self.venta.id = 7

        self.assertEqual(self.venta.id, 7)
        with self.assertRaises(Venta_Invalida_Exception):
            self.venta.id = 8

    def test_rechaza_local_invalido(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            Venta(local_id=0, fecha_hora=FECHA)

    def test_rechaza_fecha_que_no_es_datetime(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            Venta(local_id=LOCAL_ID, fecha_hora="2026-10-19")


if __name__ == "__main__":
    unittest.main()
