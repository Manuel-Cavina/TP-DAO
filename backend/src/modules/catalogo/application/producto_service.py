from decimal import Decimal
from typing import TYPE_CHECKING

from modules.catalogo.application.inicializador_stock_contract import Inicializador_Stock_Contract
from modules.catalogo.domain import Producto
from modules.catalogo.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_Duplicada_Exception,
    Entidad_No_Encontrada_Exception,
)
from modules.catalogo.dto import Item_Actualizacion_Masiva_DTO
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository

if TYPE_CHECKING:
    from modules.ubicaciones_stock.application import Stock_Service


class Producto_Service:
    """Alta, modificación, baja lógica y consulta de productos (P2, V4).

    El alta crea el stock en cero del producto en cada ubicación, en la misma transacción.
    """

    def __init__(
        self,
        inicializador_stock: Inicializador_Stock_Contract | None = None,
        producto_repository: Producto_Repository | None = None,
        categoria_repository: Categoria_Repository | None = None,
        proveedor_repository: Proveedor_Repository | None = None,
    ) -> None:
        if inicializador_stock is None:
            from modules.ubicaciones_stock.application import Stock_Service

            inicializador_stock = Stock_Service()
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

    def actualizar_masivo(self, items: list[Item_Actualizacion_Masiva_DTO]) -> list[Producto]:
        """Actualiza en bloque productos y niveles mínimos de stock.

        Fase 1: Valida la existencia e integridad de cada fila y sus relaciones activas.
        Fase 2: Aplica los cambios atómicamente; si algo falla, no se confirma nada.
        """
        if not items:
            return []

        cambios_preparados: list[
            tuple[Producto, str, Decimal, Decimal, int, int, bool | None, int | None]
        ] = []

        for raw_item in items:
            item = Item_Actualizacion_Masiva_DTO(**raw_item) if isinstance(raw_item, dict) else raw_item
            codigo = item.codigo.strip() if item.codigo else None
            producto: Producto | None = None
            if item.producto_id is not None:
                producto = self._repository.obtener_por_id(item.producto_id)
                if producto is None:
                    raise Entidad_No_Encontrada_Exception(f"No existe el producto con id {item.producto_id}.")
            elif codigo:
                producto = self._repository.obtener_por_codigo(codigo)
                if producto is None:
                    raise Entidad_No_Encontrada_Exception(f"No existe un producto con código '{codigo}'.")
            else:
                raise Datos_Invalidos_Exception("Debe indicar producto_id o codigo para cada actualización.")

            nuevo_nombre = item.nombre.strip() if item.nombre is not None else producto.nombre
            nuevo_precio = (
                Decimal(str(item.precio_venta)) if item.precio_venta is not None else producto.precio_venta
            )
            nuevo_costo = (
                Decimal(str(item.costo_unitario)) if item.costo_unitario is not None else producto.costo_unitario
            )
            nueva_cat_id = item.categoria_id if item.categoria_id is not None else producto.categoria_id
            nuevo_prov_id = item.proveedor_id if item.proveedor_id is not None else producto.proveedor_id

            if nuevo_precio <= 0:
                raise Datos_Invalidos_Exception(f"El precio de venta para '{producto.codigo}' debe ser mayor a cero.")
            if nuevo_costo <= 0:
                raise Datos_Invalidos_Exception(f"El costo unitario para '{producto.codigo}' debe ser mayor a cero.")

            self._validar_categoria_y_proveedor(nueva_cat_id, nuevo_prov_id)

            nivel_minimo = item.nivel_minimo if item.nivel_minimo is not None else item.nivel_minimo_existencia
            if nivel_minimo is not None and (not isinstance(nivel_minimo, int) or nivel_minimo <= 0):
                raise Datos_Invalidos_Exception(f"El nivel mínimo para '{producto.codigo}' debe ser mayor a cero.")

            cambios_preparados.append(
                (producto, nuevo_nombre, nuevo_precio, nuevo_costo, nueva_cat_id, nuevo_prov_id, item.activo, nivel_minimo)
            )

        actualizados: list[Producto] = []
        for producto, nom, precio, costo, cat_id, prov_id, activo, min_exist in cambios_preparados:
            producto.actualizar(nom, precio, costo, cat_id, prov_id)
            if activo is not None:
                if activo:
                    producto.activar()
                else:
                    producto.desactivar()
            self._repository.actualizar(producto)
            if min_exist is not None:
                self._inicializador_stock.actualizar_nivel_minimo_para_producto(producto.id, min_exist)
            actualizados.append(producto)

        return actualizados

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

    def listar(
        self,
        solo_activos: bool = False,
        categoria_id: int | None = None,
        q: str | None = None,
    ) -> list[Producto]:
        return self._repository.listar(solo_activos, categoria_id, q=q)

    def _validar_categoria_y_proveedor(self, categoria_id: int, proveedor_id: int) -> None:
        categoria = self._categorias.obtener_por_id(categoria_id)
        if categoria is None or not categoria.activo:
            raise Entidad_No_Encontrada_Exception(f"No existe una categoría activa con id {categoria_id}.")
        proveedor = self._proveedores.obtener_por_id(proveedor_id)
        if proveedor is None or not proveedor.activo:
            raise Entidad_No_Encontrada_Exception(f"No existe un proveedor activo con id {proveedor_id}.")
