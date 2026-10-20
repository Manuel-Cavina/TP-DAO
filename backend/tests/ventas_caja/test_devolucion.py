"""Reglas de devolución V5 (docs/implementacion.md, Integrante 3, punto 4)."""

from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.ventas_caja.domain import Devolucion, Pago_Tarjeta, Venta
from modules.ventas_caja.domain.exceptions import (
    Devolucion_Invalida_Exception,
    Venta_No_Encontrada_Exception,
)

LOCAL_ID = 10
FECHA_VENTA = datetime(2026, 10, 1, 10, 0)


def _venta_registrada() -> Venta:
    venta = Venta(local_id=LOCAL_ID, fecha_hora=FECHA_VENTA)
    venta.agregar_producto(1, 3, Decimal("100.00"))
    venta.agregar_producto(2, 1, Decimal("50.00"))
    venta.confirmar(Pago_Tarjeta("4509953566233704", 1), 1)
    venta.id = 1
    return venta


def _devolucion(venta: Venta, dias: int = 1, previas: tuple[Devolucion, ...] = ()) -> Devolucion:
    return Devolucion(
        venta=venta,
        local_id=LOCAL_ID,
        fecha_hora=FECHA_VENTA + timedelta(days=dias),
        motivo="Producto fallado",
        devoluciones_previas=previas,
    )


class TestDevolucion(unittest.TestCase):
    def setUp(self) -> None:
        self.venta = _venta_registrada()

    def test_devolucion_parcial_reintegra_precio_historico(self) -> None:
        devolucion = _devolucion(self.venta)
        devolucion.agregar_producto(1, 2)

        self.assertEqual(devolucion.monto_reintegrado, Decimal("200.00"))
        self.assertEqual(devolucion.medio_pago, "TARJETA")

    def test_mismo_producto_se_unifica(self) -> None:
        devolucion = _devolucion(self.venta)
        devolucion.agregar_producto(1, 1)
        devolucion.agregar_producto(1, 1)

        self.assertEqual(len(devolucion.detalles), 1)
        self.assertEqual(devolucion.detalles[0].cantidad, 2)

    def test_no_puede_superar_lo_comprado(self) -> None:
        devolucion = _devolucion(self.venta)

        with self.assertRaises(Devolucion_Invalida_Exception):
            devolucion.agregar_producto(1, 4)
        self.assertEqual(devolucion.detalles, ())

    def test_dos_parciales_que_se_pasan_de_lo_comprado(self) -> None:
        primera = _devolucion(self.venta)
        primera.agregar_producto(1, 2)

        segunda = _devolucion(self.venta, dias=2, previas=(primera,))
        segunda.agregar_producto(1, 1)
        with self.assertRaises(Devolucion_Invalida_Exception):
            segunda.agregar_producto(1, 1)

    def test_producto_que_no_estaba_en_la_venta(self) -> None:
        with self.assertRaises(Devolucion_Invalida_Exception):
            _devolucion(self.venta).agregar_producto(99, 1)

    def test_plazo_vencido(self) -> None:
        _devolucion(self.venta, dias=30)

        with self.assertRaises(Devolucion_Invalida_Exception):
            _devolucion(self.venta, dias=31)

    def test_plazo_vence_un_segundo_despues_de_los_30_dias(self) -> None:
        limite = FECHA_VENTA + timedelta(days=30)
        Devolucion(self.venta, LOCAL_ID, limite, "x")

        with self.assertRaises(Devolucion_Invalida_Exception):
            Devolucion(self.venta, LOCAL_ID, limite + timedelta(seconds=1), "x")

    def test_reintegro_no_incluye_recargo_de_cuotas(self) -> None:
        venta = Venta(local_id=LOCAL_ID, fecha_hora=FECHA_VENTA)
        venta.agregar_producto(1, 1, Decimal("100.00"))
        venta.confirmar(Pago_Tarjeta("4509953566233704", 12), 2)
        venta.id = 2
        devolucion = _devolucion(venta)
        devolucion.agregar_producto(1, 1)

        self.assertEqual(venta.comprobante.total_cobrado, Decimal("135.00"))
        self.assertEqual(devolucion.monto_reintegrado, Decimal("100.00"))

    def test_id_registrado_exige_devolucion_guardada(self) -> None:
        with self.assertRaises(Devolucion_Invalida_Exception):
            _devolucion(self.venta).id_registrado

    def test_fecha_anterior_a_la_venta(self) -> None:
        with self.assertRaises(Devolucion_Invalida_Exception):
            _devolucion(self.venta, dias=-1)

    def test_venta_de_otro_local(self) -> None:
        with self.assertRaises(Venta_No_Encontrada_Exception):
            Devolucion(self.venta, local_id=11, fecha_hora=FECHA_VENTA, motivo="x")

    def test_venta_no_registrada(self) -> None:
        venta = Venta(local_id=LOCAL_ID, fecha_hora=FECHA_VENTA)
        venta.agregar_producto(1, 1, Decimal("10"))

        with self.assertRaises(Venta_No_Encontrada_Exception):
            Devolucion(venta, LOCAL_ID, FECHA_VENTA, "x")

    def test_motivo_obligatorio(self) -> None:
        with self.assertRaises(Devolucion_Invalida_Exception):
            Devolucion(self.venta, LOCAL_ID, FECHA_VENTA, "  ")

    def test_cantidad_invalida(self) -> None:
        with self.assertRaises(Devolucion_Invalida_Exception):
            _devolucion(self.venta).agregar_producto(1, 0)

    def test_validar_tiene_detalles(self) -> None:
        devolucion = _devolucion(self.venta)

        with self.assertRaises(Devolucion_Invalida_Exception):
            devolucion.validar_tiene_detalles()


if __name__ == "__main__":
    unittest.main()
