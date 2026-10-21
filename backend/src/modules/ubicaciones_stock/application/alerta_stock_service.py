from modules.ubicaciones_stock.domain import Alerta_Stock
from modules.ubicaciones_stock.domain.exceptions import Entidad_No_Encontrada_Exception
from modules.ubicaciones_stock.infrastructure.alerta_stock_repository import Alerta_Stock_Repository


class Alerta_Stock_Service:
    """Consulta de alertas de stock bajo y marcado como leídas."""

    def __init__(self, alerta_repository: Alerta_Stock_Repository | None = None) -> None:
        self._repository = alerta_repository if alerta_repository is not None else Alerta_Stock_Repository()

    def listar(self, leida: bool | None = None, ubicacion_id: int | None = None) -> list[Alerta_Stock]:
        return self._repository.listar(leida, ubicacion_id)

    def marcar_leida(self, alerta_id: int) -> Alerta_Stock:
        alerta = self._repository.obtener_por_id(alerta_id)
        if alerta is None:
            raise Entidad_No_Encontrada_Exception(f"No existe la alerta {alerta_id}.")
        alerta.marcar_leida()
        self._repository.actualizar(alerta)
        return alerta
