"""Strategy de medios de pago (docs/implementacion.md, Integrante 3, punto 2)."""

from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.ventas_caja.domain import (
    Estrategia_Pago,
    Pago_Efectivo,
    Pago_Tarjeta,
    Pago_Transferencia,
)
from modules.ventas_caja.domain.exceptions import Pago_Rechazado_Exception

TARJETA = "4509 9535 6623 3704"
CBU = "0110599520000001234567"


class TestEstrategiaPago(unittest.TestCase):
    def test_estrategia_abstracta_no_se_instancia(self) -> None:
        with self.assertRaises(TypeError):
            Estrategia_Pago()

    def test_todos_los_medios_son_intercambiables(self) -> None:
        estrategias: list[Estrategia_Pago] = [
            Pago_Efectivo(Decimal("1000")),
            Pago_Tarjeta(TARJETA, 1),
            Pago_Transferencia("mi.alias.mp", "TX-1"),
        ]
        for estrategia in estrategias:
            with self.subTest(medio=estrategia.medio_pago):
                resultado = estrategia.procesar_pago(Decimal("500.00"))
                self.assertEqual(resultado.medio_pago, estrategia.medio_pago)
                self.assertGreaterEqual(resultado.monto_cobrado, Decimal("500.00"))

    def test_monto_no_positivo_o_fuera_de_rango_se_rechaza(self) -> None:
        for monto in (Decimal("0"), Decimal("-1"), 100.0, Decimal("1e30"), Decimal("NaN"), Decimal("Infinity")):
            with self.subTest(monto=monto), self.assertRaises(Pago_Rechazado_Exception):
                Pago_Efectivo(Decimal("1000")).procesar_pago(monto)


class TestPagoEfectivo(unittest.TestCase):
    def test_calcula_vuelto(self) -> None:
        resultado = Pago_Efectivo(Decimal("1000")).procesar_pago(Decimal("750.25"))

        self.assertEqual(resultado.medio_pago, "EFECTIVO")
        self.assertEqual(resultado.monto_cobrado, Decimal("750.25"))
        self.assertEqual(resultado.vuelto, Decimal("249.75"))

    def test_monto_exacto_no_tiene_vuelto(self) -> None:
        resultado = Pago_Efectivo(Decimal("500")).procesar_pago(Decimal("500"))

        self.assertEqual(resultado.vuelto, Decimal("0"))

    def test_efectivo_insuficiente_se_rechaza(self) -> None:
        with self.assertRaises(Pago_Rechazado_Exception):
            Pago_Efectivo(Decimal("100")).procesar_pago(Decimal("100.01"))

    def test_monto_recibido_invalido(self) -> None:
        for recibido in (Decimal("0"), 100, Decimal("1e30"), Decimal("99999999999999999999999999999")):
            with self.subTest(recibido=recibido), self.assertRaises(Pago_Rechazado_Exception):
                Pago_Efectivo(recibido)


class TestPagoTarjeta(unittest.TestCase):
    def test_aplica_recargo_por_cuotas(self) -> None:
        esperados = {1: "1000.00", 3: "1100.00", 6: "1200.00", 12: "1350.00"}
        for cuotas, total in esperados.items():
            with self.subTest(cuotas=cuotas):
                resultado = Pago_Tarjeta(TARJETA, cuotas).procesar_pago(Decimal("1000"))
                self.assertEqual(resultado.monto_cobrado, Decimal(total))
                self.assertEqual(resultado.recargo, Decimal(total) - Decimal("1000"))

    def test_guarda_solo_los_ultimos_digitos(self) -> None:
        pago = Pago_Tarjeta(TARJETA, 3)

        self.assertEqual(pago.ultimos_digitos, "3704")
        self.assertNotIn("4509", pago.procesar_pago(Decimal("10")).detalle)

    def test_cuotas_invalidas_se_rechazan(self) -> None:
        for cuotas in (0, 2, 24, True):
            with self.subTest(cuotas=cuotas), self.assertRaises(Pago_Rechazado_Exception):
                Pago_Tarjeta(TARJETA, cuotas)

    def test_numero_de_tarjeta_invalido(self) -> None:
        arabigos = "٤٥٠٩" * 4  # ٤٥٠٩: isdigit() los aceptaría
        for numero in ("", "1234", "4509-9535-6623-3704", "4" * 20, arabigos):
            with self.subTest(numero=numero), self.assertRaises(Pago_Rechazado_Exception):
                Pago_Tarjeta(numero, 1)


class TestPagoTransferencia(unittest.TestCase):
    def test_acepta_cbu_o_alias(self) -> None:
        for destino in (CBU, "mi.alias.mp", "CASA-CENTRAL"):
            with self.subTest(destino=destino):
                resultado = Pago_Transferencia(destino, "TX-99").procesar_pago(Decimal("10"))
                self.assertEqual(resultado.medio_pago, "TRANSFERENCIA")
                self.assertIn("TX-99", resultado.detalle)

    def test_sin_codigo_de_transaccion_se_rechaza(self) -> None:
        for codigo in ("", "   "):
            with self.subTest(codigo=codigo), self.assertRaises(Pago_Rechazado_Exception):
                Pago_Transferencia(CBU, codigo)

    def test_destino_invalido_se_rechaza(self) -> None:
        for destino in ("", "abc", "12345678", "alias con espacios", "١" * 22):
            with self.subTest(destino=destino), self.assertRaises(Pago_Rechazado_Exception):
                Pago_Transferencia(destino, "TX-1")


if __name__ == "__main__":
    unittest.main()
