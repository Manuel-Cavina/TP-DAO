"""Reglas de dominio del catálogo (Integrante 1, P2 y V4)."""

from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.catalogo.domain import Categoria, Producto, Proveedor
from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception


def _producto(**cambios: object) -> Producto:
    datos = {
        "codigo": "P-001",
        "nombre": "Agua 500ml",
        "precio_venta": Decimal("100.00"),
        "costo_unitario": Decimal("60.00"),
        "categoria_id": 1,
        "proveedor_id": 1,
    }
    datos.update(cambios)
    return Producto(**datos)


class TestProducto(unittest.TestCase):
    def test_crea_producto_valido(self) -> None:
        producto = _producto(codigo="  P-001  ")

        self.assertEqual(producto.codigo, "P-001")
        self.assertTrue(producto.activo)

    def test_precio_y_costo_deben_ser_decimal_positivo(self) -> None:
        for campo in ("precio_venta", "costo_unitario"):
            for valor in (Decimal("0"), Decimal("-1"), 100.0, Decimal("NaN")):
                with self.subTest(campo=campo, valor=valor), self.assertRaises(Datos_Invalidos_Exception):
                    _producto(**{campo: valor})

    def test_codigo_y_nombre_obligatorios(self) -> None:
        for cambios in ({"codigo": " "}, {"codigo": "X" * 51}, {"nombre": ""}):
            with self.subTest(cambios=cambios), self.assertRaises(Datos_Invalidos_Exception):
                _producto(**cambios)

    def test_categoria_y_proveedor_son_ids_positivos(self) -> None:
        for cambios in ({"categoria_id": 0}, {"proveedor_id": "1"}, {"categoria_id": True}):
            with self.subTest(cambios=cambios), self.assertRaises(Datos_Invalidos_Exception):
                _producto(**cambios)

    def test_actualizar_precio_y_baja_logica(self) -> None:
        producto = _producto()
        producto.actualizar("Agua 500ml", Decimal("120.00"), Decimal("60.00"), 1, 1)
        producto.desactivar()

        self.assertEqual(producto.precio_venta, Decimal("120.00"))
        self.assertFalse(producto.activo)


class TestProveedor(unittest.TestCase):
    def test_cuit_de_11_digitos_admite_guiones(self) -> None:
        proveedor = Proveedor("20-12345678-9", "Prov SA", "111", "ventas@prov.com")

        self.assertEqual(proveedor.cuit, "20123456789")

    def test_cuit_invalido(self) -> None:
        for cuit in ("123", "2012345678X", "201234567890", "٢" * 11, ""):
            with self.subTest(cuit=cuit), self.assertRaises(Datos_Invalidos_Exception):
                Proveedor(cuit, "Prov SA", "111", "ventas@prov.com")

    def test_email_y_datos_obligatorios(self) -> None:
        for razon, telefono, email in (("", "1", "a@b.com"), ("P", " ", "a@b.com"), ("P", "1", "sin-arroba")):
            with self.subTest(email=email), self.assertRaises(Datos_Invalidos_Exception):
                Proveedor("20123456789", razon, telefono, email)


class TestCategoria(unittest.TestCase):
    def test_nombre_obligatorio_y_baja_logica(self) -> None:
        with self.assertRaises(Datos_Invalidos_Exception):
            Categoria("  ")

        categoria = Categoria(" Bebidas ")
        categoria.desactivar()
        self.assertEqual((categoria.nombre, categoria.activo), ("Bebidas", False))


if __name__ == "__main__":
    unittest.main()
