"""DTOs para entrada/salida de la API de ventas y caja."""

from modules.ventas_caja.dto.ventas_dtos import (
    Comprobante_DTO,
    Detalle_Devolucion_DTO,
    Detalle_Venta_DTO,
    Devolucion_DTO,
    MAX_ID,
    Item_Venta_DTO,
    Pago_DTO,
    Pago_Efectivo_DTO,
    Pago_Tarjeta_DTO,
    Pago_Transferencia_DTO,
    Registrar_Devolucion_Request_DTO,
    Registrar_Venta_Request_DTO,
    Saldo_Caja_DTO,
    Venta_DTO,
)

__all__ = [
    "Comprobante_DTO",
    "Detalle_Devolucion_DTO",
    "Detalle_Venta_DTO",
    "Devolucion_DTO",
    "Item_Venta_DTO",
    "MAX_ID",
    "Pago_DTO",
    "Pago_Efectivo_DTO",
    "Pago_Tarjeta_DTO",
    "Pago_Transferencia_DTO",
    "Registrar_Devolucion_Request_DTO",
    "Registrar_Venta_Request_DTO",
    "Saldo_Caja_DTO",
    "Venta_DTO",
]
