from typing import Callable

from modules.catalogo.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_No_Encontrada_Exception,
)
from modules.catalogo.dto import Crear_Producto_DTO, Producto_DTO
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository
from modules.catalogo.mappers.catalogo_mapper import Producto_Mapper


class Producto_Service:
    """Casos de uso para la administración de productos del catálogo."""

    def __init__(
        self,
        producto_repo: Producto_Repository | None = None,
        categoria_repo: Categoria_Repository | None = None,
        proveedor_repo: Proveedor_Repository | None = None,
        stock_initializer: Callable[[int, int], None] | None = None,
    ) -> None:
        self._producto_repo = producto_repo or Producto_Repository()
        self._categoria_repo = categoria_repo or Categoria_Repository()
        self._proveedor_repo = proveedor_repo or Proveedor_Repository()
        if stock_initializer is not None:
            self._stock_initializer = stock_initializer
        else:
            from modules.ubicaciones_stock.application.stock_service import Stock_Service

            self._stock_initializer = Stock_Service().inicializar_stock_para_producto

    def crear_producto(self, dto: Crear_Producto_DTO) -> Producto_DTO:
        if dto.nivel_minimo <= 0:
            raise Datos_Invalidos_Exception("El nivel mínimo de existencia debe ser mayor a cero.")

        if not self._categoria_repo.buscar_por_id(dto.categoria_id):
            raise Entidad_No_Encontrada_Exception(f"No existe la categoría con ID {dto.categoria_id}.")

        proveedor = self._proveedor_repo.buscar_por_id(dto.proveedor_id)
        if not proveedor:
            raise Entidad_No_Encontrada_Exception(f"No existe el proveedor con ID {dto.proveedor_id}.")
        if not proveedor.activo:
            raise Datos_Invalidos_Exception(
                f"El proveedor con CUIT {proveedor.cuit} está inactivo y no puede proveer nuevos productos."
            )

        producto = self._producto_repo.crear(Producto_Mapper.to_entity(dto))
        if producto.id is not None:
            self._stock_initializer(producto.id, dto.nivel_minimo)
        return Producto_Mapper.to_dto(producto, nivel_minimo=dto.nivel_minimo)

    def actualizar_precio(self, codigo: str, nuevo_precio: float) -> Producto_DTO:
        producto = self._obtener_producto(codigo)
        producto.actualizar_precio(nuevo_precio)
        self._producto_repo.actualizar(producto)
        return Producto_Mapper.to_dto(producto)

    def dar_de_baja_producto(self, codigo: str) -> None:
        producto = self._obtener_producto(codigo)
        producto.desactivar()
        self._producto_repo.actualizar(producto)

    def listar_productos(
        self, solo_activos: bool = True, categoria_id: int | None = None
    ) -> list[Producto_DTO]:
        productos = self._producto_repo.listar(solo_activos, categoria_id)
        return [Producto_Mapper.to_dto(producto) for producto in productos]

    def obtener_producto_por_codigo(self, codigo: str) -> Producto_DTO:
        return Producto_Mapper.to_dto(self._obtener_producto(codigo))

    def _obtener_producto(self, codigo: str):
        producto = self._producto_repo.buscar_por_codigo(codigo)
        if not producto:
            raise Entidad_No_Encontrada_Exception(f"No existe el producto con código '{codigo}'.")
        return producto
