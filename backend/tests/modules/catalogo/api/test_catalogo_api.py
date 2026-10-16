from pathlib import Path
import sys
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from config.database.base import Base
from config.database.request_session_context import Request_Session_Context
from modules.catalogo.api.catalogo_controller import Catalogo_Controller
from modules.catalogo.application.categoria_service import Categoria_Service
from modules.catalogo.application.producto_service import Producto_Service
from modules.catalogo.application.proveedor_service import Proveedor_Service
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository


class CatalogoAPITests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine, expire_on_commit=False)
        self.token = Request_Session_Context.establecer_sesion(self.session)
        categoria_repo, proveedor_repo, producto_repo = Categoria_Repository(), Proveedor_Repository(), Producto_Repository()
        self.controller = Catalogo_Controller(
            Categoria_Service(categoria_repo),
            Proveedor_Service(proveedor_repo),
            Producto_Service(producto_repo, categoria_repo, proveedor_repo, lambda *_: None),
        )

    def tearDown(self) -> None:
        Request_Session_Context.restablecer(self.token)
        self.session.close()
        self.engine.dispose()

    def test_crear_categoria_endpoint(self) -> None:
        self.assertEqual(self.controller.crear_categoria({"nombre": "Ferretería"}).status_code, 201)
        self.assertEqual(self.controller.crear_categoria({"nombre": "Ferretería"}).status_code, 409)
        self.assertEqual(self.controller.crear_categoria({"nombre": "   "}).status_code, 400)

    def test_crear_proveedor_y_producto_endpoint(self) -> None:
        categoria = self.controller.crear_categoria({"nombre": "Herramientas"}).data
        proveedor = self.controller.crear_proveedor({"cuit": "30123456789", "razon_social": "Herramientas SA", "telefono": "11223344", "email": "h@sa.com"}).data
        producto = self.controller.crear_producto({
            "codigo": "HER-01", "nombre": "Martillo 500g", "precio_venta": 4500.0,
            "costo_unitario": 2800.0, "categoria_id": categoria["id"], "proveedor_id": proveedor["id"], "nivel_minimo": 5,
        })
        self.assertEqual(producto.status_code, 201)
        self.assertEqual(self.controller.actualizar_precio_producto("HER-01", {"precio_venta": 4900.0}).status_code, 200)
        self.assertEqual(self.controller.dar_de_baja_producto("HER-01").status_code, 204)
