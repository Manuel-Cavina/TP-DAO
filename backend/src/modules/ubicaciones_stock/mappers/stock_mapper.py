from modules.ubicaciones_stock.domain import Alerta_Stock, Stock, Ubicacion
from modules.ubicaciones_stock.dto import Alerta_Stock_DTO, Stock_DTO, Ubicacion_DTO


class Stock_Mapper:
    """Conversor entre ubicaciones, stock y alertas y sus DTOs."""

    @staticmethod
    def ubicacion_a_dto(ubicacion: Ubicacion) -> Ubicacion_DTO:
        return Ubicacion_DTO(
            id=ubicacion.id,
            tipo=ubicacion.tipo,
            nombre=ubicacion.nombre,
            direccion=ubicacion.direccion,
            telefono=ubicacion.telefono,
            activo=ubicacion.activo,
        )

    @staticmethod
    def stock_a_dto(stock: Stock) -> Stock_DTO:
        return Stock_DTO(
            id=stock.id,
            producto_id=stock.producto_id,
            ubicacion_id=stock.ubicacion_id,
            cantidad_disponible=stock.cantidad_disponible,
            cantidad_en_transito=stock.cantidad_en_transito,
            nivel_minimo_existencia=stock.nivel_minimo_existencia,
            en_o_bajo_minimo=stock.esta_en_o_bajo_minimo,
        )

    @staticmethod
    def alerta_a_dto(alerta: Alerta_Stock) -> Alerta_Stock_DTO:
        return Alerta_Stock_DTO(
            id=alerta.id,
            stock_id=alerta.stock_id,
            producto_id=alerta.producto_id,
            ubicacion_id=alerta.ubicacion_id,
            cantidad_disponible=alerta.cantidad_disponible,
            nivel_minimo=alerta.nivel_minimo,
            fecha_emision=alerta.fecha_emision.isoformat(),
            leida=alerta.leida,
        )
