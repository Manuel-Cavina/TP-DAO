from pathlib import Path
import sys
import unittest

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from config.database.base import Base
from config.database.request_session_context import Request_Session_Context
from modules.catalogo.domain.categoria import Categoria
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception
from modules.catalogo.domain.producto import Producto
from modules.catalogo.domain.proveedor import Proveedor
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository


class CatalogoORMTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(bind=self.engine, autoflush=True, expire_on_commit=False)
        self.token = Request_Session_Context.establecer_sesion(self.session)

        self.cat_repo = Categoria_Repository()
        self.prov_repo = Proveedor_Repository()
        self.prod_repo = Producto_Repository()

    def tearDown(self) -> None:
        Request_Session_Context.restablecer(self.token)
        self.session.close()
        self.engine.dispose()

    def test_repositorios_usan_request_session_context(self) -> None:
        # Categoria
        cat = Categoria(nombre="Bebidas")
        guardada_cat = self.cat_repo.crear(cat)
        self.assertIsNotNone(guardada_cat.id)

        # Proveedor
        prov = Proveedor(
            cuit="30123456789",
            razon_social="Distribuidora Central SA",
            telefono="11223344",
            email="contacto@central.com",
        )
        guardado_prov = self.prov_repo.crear(prov)
        self.assertIsNotNone(guardado_prov.id)

        # Producto
        prod = Producto(
            codigo="BEB-100",
            nombre="Agua Mineral 2L",
            precio_venta=800.0,
            costo_unitario=400.0,
            categoria_id=guardada_cat.id,
            proveedor_id=guardado_prov.id,
        )
        guardado_prod = self.prod_repo.crear(prod)
        self.assertIsNotNone(guardado_prod.id)

        # Verificar que viven en la misma sesión ORM
        self.assertIn(guardada_cat, self.session)
        self.assertIn(guardado_prov, self.session)
        self.assertIn(guardado_prod, self.session)

    def test_relaciones_bidireccionales_orm(self) -> None:
        cat = self.cat_repo.crear(Categoria(nombre="Snacks"))
        prov = self.prov_repo.crear(
            Proveedor(
                cuit="30987654321",
                razon_social="Snacks Express SRL",
                telefono="11556677",
                email="ventas@snacks.com",
            )
        )
        prod = self.prod_repo.crear(
            Producto(
                codigo="SNK-01",
                nombre="Papas Fritas 150g",
                precio_venta=1500.0,
                costo_unitario=900.0,
                categoria_id=cat.id,
                proveedor_id=prov.id,
            )
        )

        # Verificar relaciones
        self.assertEqual(prod.categoria.id, cat.id)
        self.assertEqual(prod.proveedor.id, prov.id)
        self.assertIn(prod, cat.productos)
        self.assertIn(prod, prov.productos)

    def test_unicidad_y_mapeo_integridad(self) -> None:
        self.cat_repo.crear(Categoria(nombre="Lácteos"))
        with self.assertRaises(Entidad_Duplicada_Exception):
            self.cat_repo.crear(Categoria(nombre="Lácteos"))

        self.prov_repo.crear(
            Proveedor(
                cuit="20112233445",
                razon_social="La Serenísima",
                telefono="1144",
                email="ls@mastellone.com",
            )
        )
        with self.assertRaises(Entidad_Duplicada_Exception):
            self.prov_repo.crear(
                Proveedor(
                    cuit="20112233445",
                    razon_social="Otra Razon",
                    telefono="1144",
                    email="x@y.com",
                )
            )

        cat = self.cat_repo.buscar_por_nombre("Lácteos")
        prov = self.prov_repo.buscar_por_cuit("20112233445")
        self.prod_repo.crear(
            Producto(
                codigo="LAC-01",
                nombre="Leche Entera 1L",
                precio_venta=1000.0,
                costo_unitario=600.0,
                categoria_id=cat.id,
                proveedor_id=prov.id,
            )
        )
        with self.assertRaises(Entidad_Duplicada_Exception):
            self.prod_repo.crear(
                Producto(
                    codigo="LAC-01",
                    nombre="Leche Descremada 1L",
                    precio_venta=1050.0,
                    costo_unitario=650.0,
                    categoria_id=cat.id,
                    proveedor_id=prov.id,
                )
            )

    def test_actualizar_y_baja_logica_orm(self) -> None:
        cat = self.cat_repo.crear(Categoria(nombre="Limpieza"))
        prov = self.prov_repo.crear(
            Proveedor(
                cuit="30778899001",
                razon_social="Química Sur",
                telefono="1122",
                email="q@sur.com",
            )
        )
        prod = self.prod_repo.crear(
            Producto(
                codigo="LIM-01",
                nombre="Detergente 500ml",
                precio_venta=500.0,
                costo_unitario=300.0,
                categoria_id=cat.id,
                proveedor_id=prov.id,
            )
        )

        # Actualizar precio
        prod.actualizar_precio(650.0)
        self.prod_repo.actualizar(prod)
        recuperado = self.prod_repo.buscar_por_codigo("LIM-01")
        self.assertEqual(recuperado.precio_venta, 650.0)

        # Desactivar producto
        prod.desactivar()
        self.prod_repo.actualizar(prod)
        self.assertFalse(self.prod_repo.buscar_por_codigo("LIM-01").activo)
        self.assertEqual(len(self.prod_repo.listar(solo_activos=True)), 0)
        self.assertEqual(len(self.prod_repo.listar(solo_activos=False)), 1)

        # Desactivar proveedor
        prov.desactivar()
        self.prov_repo.actualizar(prov)
        self.assertFalse(self.prov_repo.buscar_por_cuit("30778899001").activo)
        self.assertEqual(len(self.prov_repo.listar(solo_activos=True)), 0)
        self.assertEqual(len(self.prov_repo.listar(solo_activos=False)), 1)


if __name__ == "__main__":
    unittest.main()
