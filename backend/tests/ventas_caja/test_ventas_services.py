"""Casos de uso de venta (V3), devolución (V5) y caja con fakes de stock y catálogo."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fakes import Fake_Catalogo_Venta, Fake_Stock_Venta
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Stock_No_Encontrado_Exception,
)
from modules.ventas_caja.application import Caja_Service, Devolucion_Service, Venta_Service
from modules.ventas_caja.domain import Pago_Efectivo, Pago_Tarjeta, Pago_Transferencia
from modules.ventas_caja.domain.exceptions import (
    Devolucion_Invalida_Exception,
    Pago_Rechazado_Exception,
    Periodo_Caja_Invalido_Exception,
    Stock_Insuficiente_Exception,
    Venta_Invalida_Exception,
    Venta_No_Encontrada_Exception,
)
from modules.ventas_caja.infrastructure import Venta_Repository
from sqlite_test_case import LOCAL_ID, OTRO_LOCAL_ID, Sqlite_Test_Case

FECHA = datetime(2026, 10, 1, 10, 0)
PRECIOS = {1: Decimal("100.00"), 2: Decimal("50.00")}


class Servicios_Test_Case(Sqlite_Test_Case):
    def setUp(self) -> None:
        super().setUp()
        self.stock = Fake_Stock_Venta(
            {(1, LOCAL_ID): 10, (2, LOCAL_ID): 1, (1, OTRO_LOCAL_ID): 10},
        )
        self.ventas = Venta_Service(self.stock, Fake_Catalogo_Venta(PRECIOS))
        self.devoluciones = Devolucion_Service(self.stock)
        self.caja = Caja_Service(self.stock)

    def vender(self, items: list[tuple[int, int]], fecha: datetime = FECHA, local_id: int = LOCAL_ID):
        return self.ventas.registrar_venta(local_id, items, Pago_Efectivo(Decimal("100000")), fecha)


class TestVentaService(Servicios_Test_Case):
    def test_venta_ok_cobra_descuenta_y_guarda(self) -> None:
        venta = self.ventas.registrar_venta(
            LOCAL_ID, [(1, 2), (2, 1), (1, 1)], Pago_Tarjeta("4509953566233704", 6), FECHA
        )

        self.assertIsNotNone(venta.id)
        self.assertEqual(venta.total, Decimal("350.00"))
        self.assertEqual(venta.comprobante.total_cobrado, Decimal("420.00"))
        self.assertEqual(venta.comprobante.numero, 1)
        self.assertEqual(
            self.stock.operaciones,
            [("DESCONTAR", 1, LOCAL_ID, 3), ("DESCONTAR", 2, LOCAL_ID, 1)],
        )
        self.assertEqual(Venta_Repository().obtener_por_id(venta.id).total, Decimal("350.00"))

    def test_precio_se_copia_del_catalogo(self) -> None:
        venta = self.vender([(2, 1)])

        self.assertEqual(venta.detalles[0].precio_unitario, Decimal("50.00"))

    def test_una_linea_sin_stock_rechaza_toda_la_venta(self) -> None:
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.vender([(1, 1), (2, 2)])

        self.assertEqual(self.stock.operaciones, [])
        self.assertEqual(Venta_Repository().listar(), [])

    def test_producto_sin_stock_en_el_local_lista_todas_las_lineas_faltantes(self) -> None:
        with self.assertRaises(Stock_Insuficiente_Exception) as error:
            self.vender([(2, 5), (1, 1)], local_id=OTRO_LOCAL_ID)
        with self.assertRaises(Stock_Insuficiente_Exception) as varias:
            self.vender([(1, 11), (2, 2)])

        self.assertIn("producto 2", str(error.exception))
        self.assertIn("producto 1", str(varias.exception))
        self.assertIn("producto 2", str(varias.exception))
        self.assertEqual(self.stock.operaciones, [])

    def test_pago_rechazado_no_descuenta_stock(self) -> None:
        with self.assertRaises(Pago_Rechazado_Exception):
            self.ventas.registrar_venta(LOCAL_ID, [(1, 1)], Pago_Efectivo(Decimal("10")), FECHA)

        self.assertEqual(self.stock.operaciones, [])
        self.assertEqual(Venta_Repository().listar(), [])

    def test_venta_sin_items(self) -> None:
        with self.assertRaises(Venta_Invalida_Exception):
            self.vender([])

    def test_local_inexistente(self) -> None:
        with self.assertRaises(Stock_No_Encontrado_Exception):
            self.vender([(1, 1)], local_id=99)

    def test_comprobantes_correlativos_por_local(self) -> None:
        primera = self.vender([(1, 1)])
        segunda = self.vender([(1, 1)])
        otro_local = self.vender([(1, 1)], local_id=OTRO_LOCAL_ID)

        self.assertEqual((primera.comprobante.numero, segunda.comprobante.numero), (1, 2))
        self.assertEqual(otro_local.comprobante.numero, 1)

    def test_obtener_venta_inexistente(self) -> None:
        with self.assertRaises(Venta_No_Encontrada_Exception):
            self.ventas.obtener_venta(999)


class TestDevolucionService(Servicios_Test_Case):
    def setUp(self) -> None:
        super().setUp()
        self.venta = self.vender([(1, 3)])
        self.stock.operaciones.clear()

    def devolver(self, cantidad: int, dias: int = 1, local_id: int = LOCAL_ID):
        return self.devoluciones.registrar_devolucion(
            self.venta.id, local_id, [(1, cantidad)], "Fallado", FECHA + timedelta(days=dias)
        )

    def test_devolucion_parcial_reingresa_stock(self) -> None:
        devolucion = self.devolver(2)

        self.assertIsNotNone(devolucion.id)
        self.assertEqual(devolucion.monto_reintegrado, Decimal("200.00"))
        self.assertEqual(self.stock.operaciones, [("REINGRESAR", 1, LOCAL_ID, 2)])

    def test_devoluciones_acumuladas_no_superan_lo_comprado(self) -> None:
        self.devolver(2)

        with self.assertRaises(Devolucion_Invalida_Exception):
            self.devolver(2, dias=2)
        self.assertEqual(len(self.devoluciones.listar_por_venta(self.venta.id)), 1)

    def test_venta_inexistente(self) -> None:
        with self.assertRaises(Venta_No_Encontrada_Exception):
            self.devoluciones.registrar_devolucion(999, LOCAL_ID, [(1, 1)], "x")

    def test_venta_de_otro_local(self) -> None:
        with self.assertRaises(Venta_No_Encontrada_Exception):
            self.devolver(1, local_id=OTRO_LOCAL_ID)
        self.assertEqual(self.stock.operaciones, [])

    def test_plazo_vencido(self) -> None:
        with self.assertRaises(Devolucion_Invalida_Exception):
            self.devolver(1, dias=31)


class TestCajaService(Servicios_Test_Case):
    def test_saldo_es_ventas_cobradas_menos_devoluciones(self) -> None:
        venta = self.ventas.registrar_venta(
            LOCAL_ID, [(1, 2)], Pago_Tarjeta("4509953566233704", 3), FECHA
        )
        self.ventas.registrar_venta(
            LOCAL_ID, [(1, 1)], Pago_Transferencia("mi.alias", "TX-1"), FECHA + timedelta(hours=2)
        )
        self.vender([(1, 1)], local_id=OTRO_LOCAL_ID)
        self.devoluciones.registrar_devolucion(venta.id, LOCAL_ID, [(1, 1)], "Fallado", FECHA)
        self.vender([(1, 1)], fecha=FECHA + timedelta(days=5))

        saldo = self.caja.calcular_saldo(LOCAL_ID, date(2026, 10, 1), date(2026, 10, 1))

        self.assertEqual(saldo.cantidad_ventas, 2)
        self.assertEqual(saldo.total_ventas, Decimal("320.00"))
        self.assertEqual(saldo.cantidad_devoluciones, 1)
        self.assertEqual(saldo.total_devoluciones, Decimal("100.00"))
        self.assertEqual(saldo.saldo, Decimal("220.00"))

    def test_periodo_incluye_el_ultimo_instante_del_dia_hasta(self) -> None:
        self.vender([(1, 1)], fecha=datetime(2026, 10, 1, 23, 59, 59, 999999))
        self.vender([(1, 1)], fecha=datetime(2026, 10, 2, 0, 0, 0))

        saldo = self.caja.calcular_saldo(LOCAL_ID, date(2026, 10, 1), date(2026, 10, 1))

        self.assertEqual(saldo.cantidad_ventas, 1)
        self.assertEqual(saldo.total_ventas, Decimal("100.00"))

    def test_periodo_sin_movimientos(self) -> None:
        saldo = self.caja.calcular_saldo(LOCAL_ID, date(2026, 1, 1), date(2026, 1, 31))

        self.assertEqual(saldo.saldo, Decimal("0"))

    def test_fechas_invertidas(self) -> None:
        with self.assertRaises(Periodo_Caja_Invalido_Exception):
            self.caja.calcular_saldo(LOCAL_ID, date(2026, 2, 1), date(2026, 1, 1))


if __name__ == "__main__":
    unittest.main()
