"""Confirmación de venta y emisión de comprobante (Integrante 3, puntos 2 y 3)."""

from datetime import datetime
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.ventas_caja.domain import Pago_Efectivo, Pago_Tarjeta, Pago_Transferencia, Venta
from modules.ventas_caja.domain.exceptions import Pago_Rechazado_Exception, Venta_Invalida_Exception

LOCAL_ID = 10
FECHA = datetime(2026, 10, 19, 12, 30)


def _venta_con_productos() -> Venta:
    venta = Venta(local_id=LOCAL_ID, fecha_hora=FECHA)
    venta.agregar_producto(1, 2, Decimal("100.00"))
    venta.agregar_producto(2, 1, Decimal("50.00"))
    return venta


class TestConfirmacionVenta(unittest.TestCase):
    def test_confirma_con_los_tres_medios(self) -> None:
        casos = [
            (Pago_Efectivo(Decimal("300")), "EFECTIVO", Decimal("250.00")),
            (Pago_Tarjeta("4509953566233704", 3), "TARJETA", Decimal("275.00")),
            (Pago_Transferencia("mi.alias.mp", "TX-1"), "TRANSFERENCIA", Decimal("250.00")),
        ]
        for estrategia, medio, cobrado in casos:
            with self.subTest(medio=medio):
                venta = _venta_con_productos()
                comprobante = venta.confirmar(estrategia, numero_comprobante=1)

                self.assertTrue(venta.esta_confirmada)
                self.assertIs(venta.comprobante, comprobante)
                self.assertEqual(comprobante.medio_pago, medio)
                self.assertEqual(comprobante.total, Decimal("250.00"))
                self.assertEqual(comprobante.total_cobrado, cobrado)
                self.assertEqual(comprobante.fecha_emision, FECHA)

    def test_numero_formateado_incluye_el_local(self) -> None:
        comprobante = _venta_con_productos().confirmar(Pago_Efectivo(Decimal("250")), 42)

        self.assertEqual(comprobante.numero_formateado, "0010-00000042")

    def test_no_se_puede_confirmar_dos_veces(self) -> None:
        venta = _venta_con_productos()
        venta.confirmar(Pago_Efectivo(Decimal("250")), 1)

        with self.assertRaises(Venta_Invalida_Exception):
            venta.confirmar(Pago_Efectivo(Decimal("250")), 2)

    def test_venta_confirmada_no_admite_productos(self) -> None:
        venta = _venta_con_productos()
        venta.confirmar(Pago_Efectivo(Decimal("250")), 1)

        with self.assertRaises(Venta_Invalida_Exception):
            venta.agregar_producto(3, 1, Decimal("10"))

    def test_venta_sin_productos_no_se_confirma(self) -> None:
        venta = Venta(local_id=LOCAL_ID, fecha_hora=FECHA)

        with self.assertRaises(Venta_Invalida_Exception):
            venta.confirmar(Pago_Efectivo(Decimal("10")), 1)

    def test_pago_rechazado_deja_la_venta_sin_confirmar(self) -> None:
        venta = _venta_con_productos()

        with self.assertRaises(Pago_Rechazado_Exception):
            venta.confirmar(Pago_Efectivo(Decimal("100")), 1)
        self.assertFalse(venta.esta_confirmada)
        self.assertIsNone(venta.comprobante)

    def test_comprobante_e_id_exigen_venta_confirmada_y_guardada(self) -> None:
        venta = _venta_con_productos()
        with self.assertRaises(Venta_Invalida_Exception):
            venta.comprobante_emitido
        with self.assertRaises(Venta_Invalida_Exception):
            venta.id_registrado

        venta.confirmar(Pago_Efectivo(Decimal("250")), 1)
        venta.id = 5
        self.assertIs(venta.comprobante_emitido, venta.comprobante)
        self.assertEqual(venta.id_registrado, 5)

    def test_numero_de_comprobante_invalido(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            _venta_con_productos().confirmar(Pago_Efectivo(Decimal("250")), 0)


if __name__ == "__main__":
    unittest.main()
