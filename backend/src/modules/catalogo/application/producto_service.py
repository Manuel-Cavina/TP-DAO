from decimal import Decimal

from modules.catalogo.application.inicializador_stock_contract import Inicializador_Stock_Contract
from modules.catalogo.domain import Producto
from modules.catalogo.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_Duplicada_Exception,
    Entidad_No_Encontrada_Exception,
)
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository


class Producto_Service:
    """Alta, modificación, baja lógica y consulta de productos (P2, V4).

    El alta crea el stock en cero del producto en cada ubicación, en la misma transacción.
    """

    def __init__(
        self,
        inicializador_stock: Inicializador_Stock_Contract,
        producto_repository: Producto_Repository | None = None,
        categoria_repository: Categoria_Repository | None = None,
        proveedor_repository: Proveedor_Repository | None = None,
    ) -> None:
        self._inicializador_stock = inicializador_stock
        self._repository = producto_repository if producto_repository is not None else Producto_Repository()
        self._categorias = categoria_repository if categoria_repository is not None else Categoria_Repository()
        self._proveedores = proveedor_repository if proveedor_repository is not None else Proveedor_Repository()

    def crear(
        self,
        codigo: str,
        nombre: str,
        precio_venta: Decimal,
        costo_unitario: Decimal,
        categoria_id: int,
        proveedor_id: int,
        nivel_minimo_existencia: int,
    ) -> Producto:
        if not isinstance(nivel_minimo_existencia, int) or nivel_minimo_existencia <= 0:
            raise Datos_Invalidos_Exception("El nivel mínimo de existencia debe ser mayor a cero.")
        producto = Producto(codigo, nombre, precio_venta, costo_unitario, categoria_id, proveedor_id)
        if self._repository.obtener_por_codigo(producto.codigo) is not None:
            raise Entidad_Duplicada_Exception(f"Ya existe un producto con código '{producto.codigo}'.")
        self._validar_categoria_y_proveedor(categoria_id, proveedor_id)

        guardado = self._repository.guardar(producto)
        self._inicializador_stock.inicializar_stock_para_producto(guardado.id, nivel_minimo_existencia)
        return guardado

    def actualizar(
        self,
        producto_id: int,
        nombre: str,
        precio_venta: Decimal,
        costo_unitario: Decimal,
        categoria_id: int,
        proveedor_id: int,
    ) -> Producto:
        """Cambiar el precio no afecta ventas registradas: cada venta guarda su precio histórico."""
        producto = self.obtener(producto_id)
        producto.actualizar(nombre, precio_venta, costo_unitario, categoria_id, proveedor_id)
        self._validar_categoria_y_proveedor(categoria_id, proveedor_id)
        self._repository.actualizar(producto)
        return producto

    def desactivar(self, producto_id: int) -> Producto:
        producto = self.obtener(producto_id)
        producto.desactivar()
        self._repository.actualizar(producto)
        return producto

    def obtener(self, producto_id: int) -> Producto:
        producto = self._repository.obtener_por_id(producto_id)
        if producto is None:
            raise Entidad_No_Encontrada_Exception(f"No existe el producto {producto_id}.")
        return producto

    def listar(self, solo_activos: bool = False, categoria_id: int | None = None) -> list[Producto]:
        return self._repository.listar(solo_activos, categoria_id)

    def _validar_categoria_y_proveedor(self, categoria_id: int, proveedor_id: int) -> None:
        categoria = self._categorias.obtener_por_id(categoria_id)
        if categoria is None or not categoria.activo:
            raise Entidad_No_Encontrada_Exception(f"No existe una categoría activa con id {categoria_id}.")
        proveedor = self._proveedores.obtener_por_id(proveedor_id)
        if proveedor is None or not proveedor.activo:
            raise Entidad_No_Encontrada_Exception(f"No existe un proveedor activo con id {proveedor_id}.")
