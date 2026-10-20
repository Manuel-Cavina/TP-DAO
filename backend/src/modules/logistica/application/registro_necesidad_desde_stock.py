from modules.logistica.infrastructure.necesidad_reposicion_repository import Necesidad_Reposicion_Repository
from modules.ubicaciones_stock.application import Registro_Necesidad_Contract


class Registro_Necesidad_Desde_Stock(Registro_Necesidad_Contract):
    """Recibe del Observer de stock la necesidad de reposición de un local (insumo de P3).

    El producto y el local ya vienen validados por ubicaciones_stock. Si hay una necesidad
    pendiente del producto en el local, el repositorio no la duplica.
    """

    def __init__(self, necesidad_repository: Necesidad_Reposicion_Repository | None = None) -> None:
        self._repository = (
            necesidad_repository if necesidad_repository is not None else Necesidad_Reposicion_Repository()
        )

    def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._repository.registrar(producto_id, local_id, cantidad)
