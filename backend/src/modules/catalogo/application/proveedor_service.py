from modules.catalogo.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_No_Encontrada_Exception,
)
from modules.catalogo.dto import (
    Actualizar_Proveedor_DTO,
    Crear_Proveedor_DTO,
    Proveedor_DTO,
)
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository
from modules.catalogo.mappers.catalogo_mapper import Proveedor_Mapper


class Proveedor_Service:
    """Casos de uso para la administración de proveedores."""

    def __init__(self, repository: Proveedor_Repository | None = None) -> None:
        self._repository = repository or Proveedor_Repository()

    def crear_proveedor(self, dto: Crear_Proveedor_DTO) -> Proveedor_DTO:
        if not dto.cuit or len(dto.cuit.strip()) != 11 or not dto.cuit.strip().isdigit():
            raise Datos_Invalidos_Exception("El CUIT debe contener exactamente 11 dígitos numéricos.")
        if not dto.razon_social or not dto.razon_social.strip():
            raise Datos_Invalidos_Exception("La razón social no puede estar vacía.")
        return Proveedor_Mapper.to_dto(self._repository.crear(Proveedor_Mapper.to_entity(dto)))

    def actualizar_proveedor(
        self, cuit: str, dto: Actualizar_Proveedor_DTO
    ) -> Proveedor_DTO:
        proveedor = self._obtener_proveedor(cuit)
        proveedor.razon_social = dto.razon_social
        proveedor.telefono = dto.telefono
        proveedor.email = dto.email
        self._repository.actualizar(proveedor)
        return Proveedor_Mapper.to_dto(proveedor)

    def dar_de_baja_proveedor(self, cuit: str) -> None:
        proveedor = self._obtener_proveedor(cuit)
        proveedor.desactivar()
        self._repository.actualizar(proveedor)

    def listar_proveedores(self, solo_activos: bool = True) -> list[Proveedor_DTO]:
        return [Proveedor_Mapper.to_dto(p) for p in self._repository.listar(solo_activos)]

    def obtener_proveedor_por_cuit(self, cuit: str) -> Proveedor_DTO:
        return Proveedor_Mapper.to_dto(self._obtener_proveedor(cuit))

    def _obtener_proveedor(self, cuit: str):
        proveedor = self._repository.buscar_por_cuit(cuit)
        if not proveedor:
            raise Entidad_No_Encontrada_Exception(f"No existe el proveedor con CUIT {cuit}.")
        return proveedor
