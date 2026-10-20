"""Repositorios y adaptadores ORM de ventas_caja sobre SQLite en memoria."""

from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy.exc import IntegrityError

from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Stock_No_Encontrado_Exception,
    Stock_Insuficiente_Exception,
)
from modules.ventas_caja.domain import Devolucion, Pago_Efectivo, Pago_Tarjeta, Venta
from modules.ventas_caja.infrastructure import (
    Catalogo_Venta_Adapter,
    Devolucion_Repository,
    Stock_Venta_Adapter,
    Venta_Repository,
)
from sqlite_test_case import CD_ID, LOCAL_ID, OTRO_LOCAL_ID, Sqlite_Test_Case

FECHA = datetime(2026, 10, 1, 10, 0)


def _venta_confirmada(numero: int, local_id: int = LOCAL_ID, fecha: datetime = FECHA) -> Venta:
    venta = Venta(local_id=local_id, fecha_hora=fecha)
    venta.agregar_producto(1, 3, Decimal("100.00"))
    venta.agregar_producto(2, 1, Decimal("250.50"))
    venta.confirmar(Pago_Tarjeta("4509953566233704", 3), numero)
    return venta


class TestVentaRepository(Sqlite_Test_Case):
    def setUp(self) -> None:
        super().setUp()
        self.repo = Venta_Repository()

    def test_guarda_y_recupera_venta_completa(self) -> None:
        guardada = self.repo.guardar(_venta_confirmada(1))
        self.session.expire_all()

        venta = self.repo.obtener_por_id(guardada.id)

        self.assertIsNotNone(venta)
        self.assertEqual(venta.local_id, LOCAL_ID)
        self.assertEqual(venta.total, Decimal("550.50"))
        self.assertEqual([(d.producto_id, d.cantidad) for d in venta.detalles], [(1, 3), (2, 1)])
        self.assertTrue(venta.esta_confirmada)
        self.assertEqual(venta.comprobante.medio_pago, "TARJETA")
        self.assertEqual(venta.comprobante.total_cobrado, Decimal("605.55"))
        self.assertEqual(venta.comprobante.pago.recargo, Decimal("55.05"))

    def test_venta_inexistente_devuelve_none(self) -> None:
        self.assertIsNone(self.repo.obtener_por_id(999))

    def test_numeracion_correlativa_por_local(self) -> None:
        numeros = [self.repo.siguiente_numero_comprobante(LOCAL_ID) for _ in range(3)]

        self.assertEqual(numeros, [1, 2, 3])
        self.assertEqual(self.repo.siguiente_numero_comprobante(OTRO_LOCAL_ID), 1)

    def test_numero_reservado_se_libera_si_la_transaccion_se_revierte(self) -> None:
        self.session.commit()
        self.repo.siguiente_numero_comprobante(LOCAL_ID)
        self.session.rollback()

        self.assertEqual(self.repo.siguiente_numero_comprobante(LOCAL_ID), 1)

    def test_obtener_para_devolucion(self) -> None:
        guardada = self.repo.guardar(_venta_confirmada(1))

        self.assertEqual(self.repo.obtener_para_devolucion(guardada.id).id, guardada.id)
        self.assertIsNone(self.repo.obtener_para_devolucion(999))

    def test_numero_de_comprobante_duplicado_en_el_local(self) -> None:
        self.repo.guardar(_venta_confirmada(1))

        with self.assertRaises(IntegrityError):
            self.repo.guardar(_venta_confirmada(1))

    def test_listar_filtra_por_local_y_periodo(self) -> None:
        self.repo.guardar(_venta_confirmada(1, fecha=FECHA))
        self.repo.guardar(_venta_confirmada(2, fecha=FECHA + timedelta(days=10)))
        self.repo.guardar(_venta_confirmada(1, local_id=OTRO_LOCAL_ID))

        self.assertEqual(len(self.repo.listar()), 3)
        self.assertEqual(len(self.repo.listar(local_id=LOCAL_ID)), 2)
        self.assertEqual(len(self.repo.listar(LOCAL_ID, desde=FECHA + timedelta(days=1))), 1)

    def test_total_cobrado_del_periodo(self) -> None:
        self.repo.guardar(_venta_confirmada(1))
        self.repo.guardar(_venta_confirmada(2))

        cantidad, total = self.repo.total_cobrado(LOCAL_ID, FECHA, FECHA + timedelta(days=1))

        self.assertEqual(cantidad, 2)
        self.assertEqual(total, Decimal("1211.10"))


class TestDevolucionRepository(Sqlite_Test_Case):
    def setUp(self) -> None:
        super().setUp()
        self.venta = Venta_Repository().guardar(_venta_confirmada(1))
        self.repo = Devolucion_Repository()

    def _devolver(self, cantidad: int, dias: int = 1) -> Devolucion:
        devolucion = Devolucion(
            self.venta,
            LOCAL_ID,
            FECHA + timedelta(days=dias),
            "Fallado",
            self.repo.listar_por_venta(self.venta),
        )
        devolucion.agregar_producto(1, cantidad)
        return self.repo.guardar(devolucion)

    def test_guarda_y_lista_devoluciones_de_la_venta(self) -> None:
        self._devolver(1)
        self._devolver(2, dias=2)
        self.session.expire_all()

        devoluciones = self.repo.listar_por_venta(self.venta)

        self.assertEqual(len(devoluciones), 2)
        self.assertEqual(devoluciones[0].monto_reintegrado, Decimal("100.00"))
        self.assertEqual(devoluciones[1].detalles[0].cantidad, 2)
        self.assertEqual(devoluciones[0].medio_pago, "TARJETA")

    def test_total_reintegrado_del_periodo(self) -> None:
        self._devolver(1)
        self._devolver(1, dias=20)

        cantidad, total = self.repo.total_reintegrado(LOCAL_ID, FECHA, FECHA + timedelta(days=5))

        self.assertEqual(cantidad, 1)
        self.assertEqual(total, Decimal("100.00"))


class TestAdaptadoresIntegrante1(Sqlite_Test_Case):
    def setUp(self) -> None:
        super().setUp()
        self.cargar_catalogo_y_stock({(1, LOCAL_ID): 5, (1, CD_ID): 100})
        self.stock = Stock_Venta_Adapter()
        self.catalogo = Catalogo_Venta_Adapter()

    def test_precio_de_venta_como_decimal(self) -> None:
        self.assertEqual(self.catalogo.obtener_precio_venta(2), Decimal("250.50"))

    def test_producto_inexistente_o_inactivo(self) -> None:
        for producto_id in (3, 99):
            with self.subTest(producto_id=producto_id), self.assertRaises(Producto_No_Encontrado_Exception):
                self.catalogo.obtener_precio_venta(producto_id)

    def test_validar_local_rechaza_cd_e_inexistentes(self) -> None:
        self.stock.validar_local(LOCAL_ID)
        for ubicacion in (CD_ID, 99):
            with self.subTest(ubicacion=ubicacion), self.assertRaises(Stock_No_Encontrado_Exception):
                self.stock.validar_local(ubicacion)

    def test_descontar_y_reingresar(self) -> None:
        self.stock.descontar_por_venta(1, LOCAL_ID, 3)
        self.assertEqual(self.stock.consultar_disponible(1, LOCAL_ID), 2)

        self.stock.reingresar_por_devolucion(1, LOCAL_ID, 1)
        self.assertEqual(self.stock.consultar_disponible(1, LOCAL_ID), 3)
        self.assertEqual(self.disponible(1, CD_ID), 100)

    def test_descontar_de_mas_no_modifica(self) -> None:
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.stock.descontar_por_venta(1, LOCAL_ID, 6)

        self.assertEqual(self.disponible(1, LOCAL_ID), 5)

    def test_sin_registro_de_stock(self) -> None:
        self.assertEqual(self.stock.consultar_disponible(2, LOCAL_ID), 0)
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.stock.descontar_por_venta(2, LOCAL_ID, 1)
        with self.assertRaises(Stock_No_Encontrado_Exception):
            self.stock.reingresar_por_devolucion(2, LOCAL_ID, 1)


if __name__ == "__main__":
    unittest.main()
