from modules.catalogo.domain import Categoria, Producto, Proveedor
from modules.catalogo.dto import (
    Categoria_DTO,
    Crear_Categoria_DTO,
    Crear_Producto_DTO,
    Crear_Proveedor_DTO,
    Producto_DTO,
    Proveedor_DTO,
)


class Categoria_Mapper:
    @staticmethod
    def to_dto(entity: Categoria) -> Categoria_DTO:
        return Categoria_DTO(id=entity.id, nombre=entity.nombre)

    @staticmethod
    def to_entity(dto: Crear_Categoria_DTO) -> Categoria:
        return Categoria(nombre=dto.nombre)


class Proveedor_Mapper:
    @staticmethod
    def to_dto(entity: Proveedor) -> Proveedor_DTO:
        return Proveedor_DTO(
            id=entity.id,
            cuit=entity.cuit,
            razon_social=entity.razon_social,
            telefono=entity.telefono,
            email=entity.email,
            activo=entity.activo,
        )

    @staticmethod
    def to_entity(dto: Crear_Proveedor_DTO) -> Proveedor:
        return Proveedor(
            cuit=dto.cuit,
            razon_social=dto.razon_social,
            telefono=dto.telefono,
            email=dto.email,
        )


class Producto_Mapper:
    @staticmethod
    def to_dto(entity: Producto, nivel_minimo: int = 1) -> Producto_DTO:
        return Producto_DTO(
            id=entity.id,
            codigo=entity.codigo,
            nombre=entity.nombre,
            precio_venta=entity.precio_venta,
            costo_unitario=entity.costo_unitario,
            categoria_id=entity.categoria_id,
            proveedor_id=entity.proveedor_id,
            activo=entity.activo,
            nivel_minimo=nivel_minimo,
        )

    @staticmethod
    def to_entity(dto: Crear_Producto_DTO) -> Producto:
        return Producto(
            codigo=dto.codigo,
            nombre=dto.nombre,
            precio_venta=dto.precio_venta,
            costo_unitario=dto.costo_unitario,
            categoria_id=dto.categoria_id,
            proveedor_id=dto.proveedor_id,
        )
