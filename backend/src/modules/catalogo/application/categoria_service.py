from modules.catalogo.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_No_Encontrada_Exception,
)
from modules.catalogo.dto import Categoria_DTO, Crear_Categoria_DTO
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.mappers.catalogo_mapper import Categoria_Mapper


class Categoria_Service:
    """Caso de uso para la administración de categorías del catálogo."""

    def __init__(self, repository: Categoria_Repository | None = None) -> None:
        self._repository = repository or Categoria_Repository()

    def crear_categoria(self, dto: Crear_Categoria_DTO) -> Categoria_DTO:
        if not dto.nombre or not dto.nombre.strip():
            raise Datos_Invalidos_Exception("El nombre de la categoría no puede estar vacío.")
        return Categoria_Mapper.to_dto(self._repository.crear(Categoria_Mapper.to_entity(dto)))

    def listar_categorias(self) -> list[Categoria_DTO]:
        return [Categoria_Mapper.to_dto(entidad) for entidad in self._repository.listar()]

    def obtener_categoria_por_id(self, categoria_id: int) -> Categoria_DTO:
        entidad = self._repository.buscar_por_id(categoria_id)
        if not entidad:
            raise Entidad_No_Encontrada_Exception(f"No existe la categoría con ID {categoria_id}.")
        return Categoria_Mapper.to_dto(entidad)
