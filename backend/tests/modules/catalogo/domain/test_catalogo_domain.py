from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from modules.catalogo.domain.categoria import Categoria
from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception
from modules.catalogo.domain.producto import Producto
from modules.catalogo.domain.proveedor import Proveedor


class CatalogoDomainTests(unittest.TestCase):
    def test_creacion_categoria_valida(self) -> None:
        cat = Categoria(nombre="Bebidas", id=1)
        self.assertEqual(cat.nombre, "Bebidas")
        self.assertEqual(cat.id, 1)

    def test_categoria_rechaza_nombre_vacio(self) -> None:
        with self.assertRaises(Datos_Invalidos_Exception):
            Categoria(nombre="   ")

    def test_creacion_proveedor_valido(self) -> None:
        prov = Proveedor(
            cuit="20123456789",
            razon_social="Distribuidora Sur",
            telefono="1144556677",
            email="contacto@sur.com",
            id=1,
        )
        self.assertEqual(prov.cuit, "20123456789")
        self.assertTrue(prov.activo)
        prov.desactivar()
        self.assertFalse(prov.activo)

    def test_proveedor_rechaza_cuit_invalido(self) -> None:
        with self.assertRaises(Datos_Invalidos_Exception):
            Proveedor(
                cuit="12345",  # menos de 11 dígitos
                razon_social="Proveedor X",
                telefono="111",
                email="a@b.com",
            )
        with self.assertRaises(Datos_Invalidos_Exception):
            Proveedor(
                cuit="2012345678A",  # caracteres no numéricos
                razon_social="Proveedor X",
                telefono="111",
                email="a@b.com",
            )

    def test_creacion_producto_valido(self) -> None:
        prod = Producto(
            codigo="PROD-001",
            nombre="Yerba Mate 1kg",
            precio_venta=1500.0,
            costo_unitario=900.0,
            categoria_id=1,
            proveedor_id=2,
        )
        self.assertEqual(prod.codigo, "PROD-001")
        self.assertEqual(prod.precio_venta, 1500.0)
        self.assertTrue(prod.activo)

    def test_producto_rechaza_precios_y_costos_invalidos(self) -> None:
        with self.assertRaises(Datos_Invalidos_Exception):
            Producto(
                codigo="P1",
                nombre="Prod",
                precio_venta=0.0,
                costo_unitario=500.0,
                categoria_id=1,
                proveedor_id=1,
            )
        with self.assertRaises(Datos_Invalidos_Exception):
            Producto(
                codigo="P1",
                nombre="Prod",
                precio_venta=1000.0,
                costo_unitario=-10.0,
                categoria_id=1,
                proveedor_id=1,
            )

    def test_actualizar_precio_producto(self) -> None:
        prod = Producto(
            codigo="P1",
            nombre="Prod",
            precio_venta=1000.0,
            costo_unitario=500.0,
            categoria_id=1,
            proveedor_id=1,
        )
        prod.actualizar_precio(1200.0)
        self.assertEqual(prod.precio_venta, 1200.0)
        with self.assertRaises(Datos_Invalidos_Exception):
            prod.actualizar_precio(0.0)


if __name__ == "__main__":
    unittest.main()
