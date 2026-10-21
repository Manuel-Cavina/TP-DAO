"""Cálculos de las filas de reportes y validación del período (Integrante 4)."""

from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.reportes.domain import (
    Existencia,
    Producto_Vendido,
    Rango_Fechas,
    Tiempo_Transito_Local,
    Ventas_Por_Medio_Pago,
)
from modules.reportes.domain.exceptions import Rango_Fechas_Invalido_Exception


def _producto(**cambios: object) -> Producto_Vendido:
    datos = {
        "producto_id": 1, "codigo": "A", "nombre": "A", "unidades_vendidas": 3, "unidades_devueltas": 1,
        "ingresos_brutos": Decimal("300.00"), "ingresos_devueltos": Decimal("100.00"), "costo_unitario": Decimal("60.00"),
    }
    datos.update(cambios)
    return Producto_Vendido(**datos)


class TestRangoFechas(unittest.TestCase):
    def test_incluye_los_dias_completos(self) -> None:
        rango = Rango_Fechas(date(2026, 1, 1), date(2026, 1, 31))

        self.assertEqual(rango.inicio, datetime(2026, 1, 1, 0, 0))
        self.assertEqual(rango.fin, datetime.combine(date(2026, 1, 31), time.max))

    def test_desde_posterior_a_hasta(self) -> None:
        with self.assertRaises(Rango_Fechas_Invalido_Exception):
            Rango_Fechas(date(2026, 2, 1), date(2026, 1, 1))


class TestFilasReporte(unittest.TestCase):
    def test_ventas_neto_descuenta_devoluciones(self) -> None:
        fila = Ventas_Por_Medio_Pago(2, "Centro", "EFECTIVO", 3, Decimal("500.00"), 1, Decimal("120.00"))

        self.assertEqual(fila.total_neto, Decimal("380.00"))

    def test_producto_unidades_netas_y_margen(self) -> None:
        fila = _producto()

        self.assertEqual((fila.unidades_netas, fila.ingresos, fila.costo), (2, Decimal("200.00"), Decimal("120.00")))
        self.assertEqual((fila.margen, fila.margen_porcentaje, fila.margen_negativo), (Decimal("80.00"), Decimal("40.00"), False))

    def test_producto_con_perdida(self) -> None:
        fila = _producto(unidades_devueltas=0, ingresos_devueltos=Decimal("0"), ingresos_brutos=Decimal("150.00"), costo_unitario=Decimal("70.00"))

        self.assertEqual((fila.margen, fila.margen_porcentaje, fila.margen_negativo), (Decimal("-60.00"), Decimal("-40.00"), True))

    def test_producto_sin_ingresos_no_divide_por_cero(self) -> None:
        fila = _producto(unidades_vendidas=1, ingresos_brutos=Decimal("100.00"))

        self.assertEqual(fila.margen_porcentaje, Decimal("0.00"))

    def test_existencia_faltante_y_valorizacion(self) -> None:
        bajo = Existencia(1, "A", "A", 2, "Centro", 1, 4, 3, Decimal("10.50"))
        sobrado = Existencia(1, "A", "A", 2, "Centro", 8, 0, 3, Decimal("10.50"))

        self.assertEqual((bajo.faltante, bajo.en_o_bajo_minimo, bajo.valorizacion), (2, True, Decimal("10.50")))
        self.assertEqual((sobrado.faltante, sobrado.en_o_bajo_minimo), (0, False))

    def test_tiempo_de_transito(self) -> None:
        fila = Tiempo_Transito_Local(2, "Centro", (Decimal("10.00"), Decimal("20.00"), Decimal("36.00")))

        self.assertEqual(
            (fila.cantidad_bultos, fila.promedio_horas, fila.minimo_horas, fila.maximo_horas),
            (3, Decimal("22.00"), Decimal("10.00"), Decimal("36.00")),
        )


if __name__ == "__main__":
    unittest.main()
