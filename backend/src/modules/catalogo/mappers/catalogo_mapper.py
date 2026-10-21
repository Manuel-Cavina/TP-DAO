from modules.catalogo.domain import Categoria, Producto, Proveedor
from modules.catalogo.dto import Categoria_DTO, Producto_DTO, Proveedor_DTO


class Catalogo_Mapper:
    """Conversor entre entidades del catálogo y sus DTOs."""

    @staticmethod
    def categoria_a_dto(categoria: Categoria) -> Categoria_DTO:
        return Categoria_DTO(id=categoria.id, nombre=categoria.nombre, activo=categoria.activo)

    @staticmethod
    def proveedor_a_dto(proveedor: Proveedor) -> Proveedor_DTO:
        return Proveedor_DTO(
            id=proveedor.id,
            cuit=proveedor.cuit,
            razon_social=proveedor.razon_social,
            telefono=proveedor.telefono,
            email=proveedor.email,
            activo=proveedor.activo,
        )

    @staticmethod
    def producto_a_dto(producto: Producto) -> Producto_DTO:
        return Producto_DTO(
            id=producto.id,
            codigo=producto.codigo,
            nombre=producto.nombre,
            precio_venta=producto.precio_venta,
            costo_unitario=producto.costo_unitario,
            categoria_id=producto.categoria_id,
            proveedor_id=producto.proveedor_id,
            activo=producto.activo,
        )
