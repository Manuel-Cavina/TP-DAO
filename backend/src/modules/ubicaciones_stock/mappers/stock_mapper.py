from modules.ubicaciones_stock.domain import (
    Alerta_Stock,
    Centro_Distribucion,
    Local,
    Stock,
    Ubicacion,
)
from modules.ubicaciones_stock.dto import (
    Alerta_Stock_DTO,
    Crear_CD_DTO,
    Crear_Local_DTO,
    Stock_DTO,
    Ubicacion_DTO,
)


class Ubicacion_Mapper:
    @staticmethod
    def to_dto(entity: Ubicacion) -> Ubicacion_DTO:
        return Ubicacion_DTO(
            id=entity.id,
            tipo=entity.tipo,
            nombre=entity.nombre,
            direccion=entity.direccion,
            telefono=entity.telefono,
            activo=entity.activo,
        )

    @staticmethod
    def to_entity_cd(dto: Crear_CD_DTO) -> Centro_Distribucion:
        return Centro_Distribucion(
            nombre=dto.nombre,
            direccion=dto.direccion,
            telefono=dto.telefono,
        )

    @staticmethod
    def to_entity_local(dto: Crear_Local_DTO) -> Local:
        return Local(
            nombre=dto.nombre,
            direccion=dto.direccion,
            telefono=dto.telefono,
        )


class Stock_Mapper:
    @staticmethod
    def to_dto(entity: Stock) -> Stock_DTO:
        return Stock_DTO(
            id=entity.id,
            producto_id=entity.producto_id,
            ubicacion_id=entity.ubicacion_id,
            cantidad_disponible=entity.cantidad_disponible,
            cantidad_en_transito=entity.cantidad_en_transito,
            nivel_minimo_existencia=entity.nivel_minimo_existencia,
        )


class Alerta_Stock_Mapper:
    @staticmethod
    def to_dto(entity: Alerta_Stock) -> Alerta_Stock_DTO:
        return Alerta_Stock_DTO(
            id=entity.id,
            stock_id=entity.stock_id,
            producto_id=entity.producto_id,
            ubicacion_id=entity.ubicacion_id,
            cantidad_disponible=entity.cantidad_disponible,
            nivel_minimo=entity.nivel_minimo,
            fecha_emision=entity.fecha_emision,
            leida=entity.leida,
        )
