from abc import ABC, abstractmethod


class Registro_Necesidad_Contract(ABC):
    """Puerto hacia logística: registrar una necesidad de reposición de un local.

    Lo implementa logística; ubicaciones_stock no conoce cómo se consolidan las órdenes.
    Si ya hay una necesidad pendiente del producto en el local, no se duplica.
    """

    @abstractmethod
    def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> None:
        raise NotImplementedError
