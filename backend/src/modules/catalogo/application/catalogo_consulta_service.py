from modules.catalogo.domain import Producto
from modules.catalogo.domain.exceptions import Entidad_No_Encontrada_Exception
from modules.catalogo.infrastructure.producto_repository import Producto_Repository


class Catalogo_Consulta_Service:
    """API pública de solo lectura del catálogo para otros módulos (stock, ventas, logística)."""

    def __init__(self, producto_repository: Producto_Repository | None = None) -> None:
        self._repository = producto_repository if producto_repository is not None else Producto_Repository()

    def obtener_producto_activo(self, producto_id: int) -> Producto:
        producto = self._repository.obtener_por_id(producto_id)
        if producto is None or not producto.activo:
            raise Entidad_No_Encontrada_Exception(f"No existe un producto activo con id {producto_id}.")
        return producto

    def listar_ids_productos_activos(self) -> list[int]:
        return [producto.id for producto in self._repository.listar(solo_activos=True)]
