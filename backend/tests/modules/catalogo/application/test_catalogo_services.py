from pathlib import Path
import sys
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from config.database.base import Base
from config.database.request_session_context import Request_Session_Context
from modules.catalogo.application.categoria_service import Categoria_Service
from modules.catalogo.application.producto_service import Producto_Service
from modules.catalogo.application.proveedor_service import Proveedor_Service
from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception, Entidad_No_Encontrada_Exception
from modules.catalogo.dto import (
    Actualizar_Proveedor_DTO,
    Crear_Categoria_DTO,
    Crear_Producto_DTO,
    Crear_Proveedor_DTO,
)
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository


class CatalogoServicesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine, expire_on_commit=False)
        self.token = Request_Session_Context.establecer_sesion(self.session)
        self.cat_service = Categoria_Service(Categoria_Repository())
        self.prov_service = Proveedor_Service(Proveedor_Repository())
        self.prod_repo = Producto_Repository()

    def tearDown(self) -> None:
        Request_Session_Context.restablecer(self.token)
        self.session.close()
        self.engine.dispose()

    def test_categoria_service_flujo_completo(self) -> None:
        creada = self.cat_service.crear_categoria(Crear_Categoria_DTO(nombre="Golosinas"))
        self.assertEqual(self.cat_service.obtener_categoria_por_id(creada.id).nombre, "Golosinas")
        with self.assertRaises(Entidad_No_Encontrada_Exception):
            self.cat_service.obtener_categoria_por_id(999)

    def test_proveedor_service_flujo_completo(self) -> None:
        self.prov_service.crear_proveedor(Crear_Proveedor_DTO("30554433221", "Alfajores SRL", "11223344", "ventas@alfajores.com"))
        actualizado = self.prov_service.actualizar_proveedor(
            "30554433221", Actualizar_Proveedor_DTO("Alfajores del Centro SRL", "11998877", "nuevo@alfajores.com")
        )
        self.assertEqual(actualizado.razon_social, "Alfajores del Centro SRL")
        self.prov_service.dar_de_baja_proveedor("30554433221")
        self.assertEqual(self.prov_service.listar_proveedores(), [])

    def test_producto_service_inicializa_stock(self) -> None:
        categoria = self.cat_service.crear_categoria(Crear_Categoria_DTO(nombre="Almacén"))
        proveedor = self.prov_service.crear_proveedor(Crear_Proveedor_DTO("20111111112", "Molinos", "1111", "a@m.com"))
        inicializaciones: list[tuple[int, int]] = []

        def inicializar_stock(producto_id: int, nivel_minimo: int) -> None:
            inicializaciones.append((producto_id, nivel_minimo))

        service = Producto_Service(
            self.prod_repo, Categoria_Repository(), Proveedor_Repository(), inicializar_stock
        )
        producto = service.crear_producto(Crear_Producto_DTO(
            "HAR-01", "Harina 0000 1kg", 850.0, 500.0, categoria.id, proveedor.id, 10
        ))
        self.assertEqual(inicializaciones, [(producto.id, 10)])

    def test_producto_rechaza_proveedor_inactivo(self) -> None:
        categoria = self.cat_service.crear_categoria(Crear_Categoria_DTO(nombre="Almacén"))
        proveedor = self.prov_service.crear_proveedor(Crear_Proveedor_DTO("20222222223", "Inactivo SA", "1111", "a@i.com"))
        self.prov_service.dar_de_baja_proveedor(proveedor.cuit)
        service = Producto_Service(self.prod_repo, Categoria_Repository(), Proveedor_Repository(), lambda *_: None)
        with self.assertRaises(Datos_Invalidos_Exception):
            service.crear_producto(Crear_Producto_DTO("PROD-INAC", "Prod", 100.0, 50.0, categoria.id, proveedor.id))
