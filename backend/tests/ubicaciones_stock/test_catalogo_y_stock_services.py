"""Servicios de catálogo, ubicaciones y stock con SQLite en memoria (Integrante 1)."""

from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from config.database.base import Base
from config.database.model_registry import cargar_modelos
from config.database.request_session_context import Request_Session_Context
from modules.catalogo.application import Categoria_Service, Producto_Service, Proveedor_Service
from modules.catalogo.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_Duplicada_Exception,
    Entidad_No_Encontrada_Exception as Catalogo_No_Encontrado_Exception,
)
from modules.ubicaciones_stock.application import (
    Alerta_Stock_Observer,
    Alerta_Stock_Service,
    Registro_Necesidad_Contract,
    Reposicion_Local_Observer,
    Stock_Service,
    Ubicacion_Service,
)
from modules.ubicaciones_stock.domain.exceptions import (
    Centro_Distribucion_Duplicado_Exception,
    Entidad_No_Encontrada_Exception,
    Ingreso_No_Permitido_Exception,
    Stock_Insuficiente_Exception,
)


class Registro_Espia(Registro_Necesidad_Contract):
    def __init__(self) -> None:
        self.necesidades: list[tuple[int, int, int]] = []

    def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self.necesidades.append((producto_id, local_id, cantidad))


class TestCatalogoYStockServices(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
        cargar_modelos()
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self._token = Request_Session_Context.establecer_sesion(self.session)

        self.registro = Registro_Espia()
        self.stock = Stock_Service(observadores=[Alerta_Stock_Observer(), Reposicion_Local_Observer(self.registro)])
        self.ubicaciones = Ubicacion_Service()
        self.categorias = Categoria_Service()
        self.proveedores = Proveedor_Service()
        self.productos = Producto_Service(inicializador_stock=self.stock)

        self.cd = self.ubicaciones.crear_centro_distribucion("CD Central", "Ruta 9")
        self.local = self.ubicaciones.crear_local("Local Centro", "San Martín 100", "4444-0000")
        self.categoria = self.categorias.crear("Bebidas")
        self.proveedor = self.proveedores.crear("20-12345678-9", "Prov SA", "111", "ventas@prov.com")

    def tearDown(self) -> None:
        Request_Session_Context.restablecer(self._token)
        self.session.close()
        self.engine.dispose()

    def _producto(self, codigo: str = "P-1", nivel_minimo: int = 3):
        return self.productos.crear(
            codigo, "Agua", Decimal("100.00"), Decimal("60.00"), self.categoria.id, self.proveedor.id, nivel_minimo
        )

    # --- Catálogo ---

    def test_alta_de_producto_crea_stock_en_cero_en_cada_ubicacion(self) -> None:
        producto = self._producto(nivel_minimo=4)

        stocks = self.stock.listar(producto_id=producto.id)
        self.assertEqual({s.ubicacion_id for s in stocks}, {self.cd.id, self.local.id})
        self.assertTrue(all(s.cantidad_disponible == 0 and s.nivel_minimo_existencia == 4 for s in stocks))

    def test_ubicacion_nueva_nace_con_stock_de_los_productos_activos(self) -> None:
        producto = self._producto()
        otro_local = self.ubicaciones.crear_local("Local Norte", "Rivadavia 200")

        self.assertEqual(self.stock.consultar_stock(producto.id, otro_local.id).cantidad_disponible, 0)

    def test_codigo_cuit_y_categoria_no_se_duplican(self) -> None:
        self._producto("P-1")
        for operacion in (
            lambda: self._producto("P-1"),
            lambda: self.proveedores.crear("20123456789", "Otro", "1", "a@b.com"),
            lambda: self.categorias.crear("Bebidas"),
        ):
            with self.subTest(), self.assertRaises(Entidad_Duplicada_Exception):
                operacion()

    def test_producto_exige_categoria_y_proveedor_activos_y_minimo_positivo(self) -> None:
        self.proveedores.desactivar(self.proveedor.id)
        with self.assertRaises(Catalogo_No_Encontrado_Exception):
            self._producto()
        with self.assertRaises(Datos_Invalidos_Exception):
            self._producto(nivel_minimo=0)

    def test_cambio_de_precio_y_baja_logica(self) -> None:
        producto = self._producto()
        self.productos.actualizar(producto.id, "Agua", Decimal("150.00"), Decimal("60.00"), self.categoria.id, self.proveedor.id)
        self.productos.desactivar(producto.id)

        actualizado = self.productos.obtener(producto.id)
        self.assertEqual((actualizado.precio_venta, actualizado.activo), (Decimal("150.00"), False))

    # --- Ubicaciones ---

    def test_un_solo_cd_y_baja_logica_de_local(self) -> None:
        with self.assertRaises(Centro_Distribucion_Duplicado_Exception):
            self.ubicaciones.crear_centro_distribucion("Otro CD", "Ruta 8")

        self.ubicaciones.desactivar(self.local.id)
        with self.assertRaises(Entidad_No_Encontrada_Exception):
            self.ubicaciones.validar_local(self.local.id)
        self.assertFalse(self.ubicaciones.obtener(self.local.id).activo)

    # --- Stock: ingreso y contratos ---

    def test_ingreso_solo_al_cd(self) -> None:
        producto = self._producto()

        self.assertEqual(self.stock.ingresar_mercaderia_cd(producto.id, self.cd.id, 50).cantidad_disponible, 50)
        with self.assertRaises(Ingreso_No_Permitido_Exception):
            self.stock.ingresar_mercaderia_cd(producto.id, self.local.id, 5)
        with self.assertRaises(Catalogo_No_Encontrado_Exception):
            self.stock.ingresar_mercaderia_cd(999, self.cd.id, 5)

    def test_contratos_de_logistica_y_ventas(self) -> None:
        producto = self._producto(nivel_minimo=1)
        self.stock.ingresar_mercaderia_cd(producto.id, self.cd.id, 20)

        self.stock.reservar_para_despacho(producto.id, self.cd.id, 10)
        self.stock.registrar_en_transito(producto.id, self.local.id, 10)
        self.assertEqual(self.stock.consultar_disponible(producto.id, self.local.id), 0)

        self.stock.acreditar_verificado(producto.id, self.local.id, 8)
        self.stock.registrar_merma(producto.id, self.local.id, 2)
        self.stock.descontar_por_venta(producto.id, self.local.id, 3)
        self.stock.reingresar_por_devolucion(producto.id, self.local.id, 1)

        local = self.stock.consultar_stock(producto.id, self.local.id)
        self.assertEqual((local.cantidad_disponible, local.cantidad_en_transito), (6, 0))
        self.assertEqual(self.stock.consultar_disponible(producto.id, self.cd.id), 10)

    def test_no_se_vende_ni_reserva_mas_de_lo_disponible(self) -> None:
        producto = self._producto()
        self.stock.ingresar_mercaderia_cd(producto.id, self.cd.id, 5)

        for operacion in (
            lambda: self.stock.reservar_para_despacho(producto.id, self.cd.id, 6),
            lambda: self.stock.descontar_por_venta(producto.id, self.local.id, 1),
            lambda: self.stock.acreditar_verificado(producto.id, self.local.id, 1),
            lambda: self.stock.descontar_por_venta(999, self.local.id, 1),
        ):
            with self.subTest(), self.assertRaises(Stock_Insuficiente_Exception):
                operacion()
        self.assertEqual(self.stock.consultar_disponible(producto.id, self.cd.id), 5)

    # --- Observer con persistencia ---

    def test_venta_bajo_minimo_genera_alerta_y_necesidad_del_local(self) -> None:
        producto = self._producto(nivel_minimo=3)
        self.stock.registrar_en_transito(producto.id, self.local.id, 5)
        self.stock.acreditar_verificado(producto.id, self.local.id, 5)

        self.stock.descontar_por_venta(producto.id, self.local.id, 2)
        self.stock.descontar_por_venta(producto.id, self.local.id, 1)

        alertas = Alerta_Stock_Service().listar(leida=False)
        self.assertEqual(len(alertas), 1, "Una alerta sin leer por stock: no se repite")
        self.assertEqual((alertas[0].ubicacion_id, alertas[0].cantidad_disponible), (self.local.id, 3))
        self.assertEqual(self.registro.necesidades, [(producto.id, self.local.id, 3), (producto.id, self.local.id, 4)])

        Alerta_Stock_Service().marcar_leida(alertas[0].id)
        self.assertEqual(Alerta_Stock_Service().listar(leida=False), [])

    def test_reserva_del_cd_alerta_pero_no_pide_reposicion(self) -> None:
        producto = self._producto(nivel_minimo=5)
        self.stock.ingresar_mercaderia_cd(producto.id, self.cd.id, 6)

        self.stock.reservar_para_despacho(producto.id, self.cd.id, 2)

        self.assertEqual(len(Alerta_Stock_Service().listar(ubicacion_id=self.cd.id)), 1)
        self.assertEqual(self.registro.necesidades, [])


if __name__ == "__main__":
    unittest.main()
