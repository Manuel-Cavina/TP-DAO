from modules.ubicaciones_stock.domain.exceptions import (
    Datos_Invalidos_Exception, Entidad_Duplicada_Exception, Entidad_No_Encontrada_Exception,
    Ubicacion_Con_Stock_Exception,
)
from modules.ubicaciones_stock.dto import Crear_CD_DTO, Crear_Local_DTO, Ubicacion_DTO
from modules.ubicaciones_stock.infrastructure.ubicacion_repository import Ubicacion_Repository
from modules.ubicaciones_stock.mappers.stock_mapper import Ubicacion_Mapper


class Ubicacion_Service:
    """Casos de uso para el Centro de Distribución y los locales."""

    def __init__(self, repository: Ubicacion_Repository | None = None) -> None:
        self._repository = repository or Ubicacion_Repository()

    def crear_centro_distribucion(self, dto: Crear_CD_DTO) -> Ubicacion_DTO:
        if not dto.nombre.strip() or not dto.direccion.strip():
            raise Datos_Invalidos_Exception("El nombre y la dirección del Centro de Distribución son obligatorios.")
        if self._repository.obtener_centro_distribucion():
            raise Entidad_Duplicada_Exception("Ya existe un Centro de Distribución registrado en el sistema.")
        return Ubicacion_Mapper.to_dto(self._repository.crear(Ubicacion_Mapper.to_entity_cd(dto)))

    def crear_local(self, dto: Crear_Local_DTO) -> Ubicacion_DTO:
        if not dto.nombre.strip() or not dto.direccion.strip() or not dto.telefono.strip():
            raise Datos_Invalidos_Exception("El nombre, la dirección y el teléfono del local son obligatorios.")
        return Ubicacion_Mapper.to_dto(self._repository.crear(Ubicacion_Mapper.to_entity_local(dto)))

    def dar_de_baja_ubicacion(self, ubicacion_id: int) -> None:
        ubicacion = self._repository.buscar_por_id(ubicacion_id)
        if not ubicacion:
            raise Entidad_No_Encontrada_Exception(f"No existe la ubicación con ID {ubicacion_id}.")
        if self._repository.tiene_stock_asociado(ubicacion_id):
            raise Ubicacion_Con_Stock_Exception(
                f"No se puede dar de baja la ubicación '{ubicacion.nombre}' porque posee stock disponible o en tránsito."
            )
        ubicacion.desactivar()
        self._repository.actualizar(ubicacion)

    def listar_ubicaciones(self, solo_activas: bool = True) -> list[Ubicacion_DTO]:
        return [Ubicacion_Mapper.to_dto(ubicacion) for ubicacion in self._repository.listar(solo_activas)]

    def obtener_ubicacion_por_id(self, ubicacion_id: int) -> Ubicacion_DTO:
        ubicacion = self._repository.buscar_por_id(ubicacion_id)
        if not ubicacion:
            raise Entidad_No_Encontrada_Exception(f"No existe la ubicación con ID {ubicacion_id}.")
        return Ubicacion_Mapper.to_dto(ubicacion)
