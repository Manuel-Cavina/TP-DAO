from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StrictInt

# Topes de transporte: más allá de estos valores SQLite desborda (INTEGER de 64 bits)
# o el importe no entra en Numeric(12, 2); se rechazan con 400 en vez de llegar a un 500.
MAX_ID = 2**63 - 1
MAX_CANTIDAD = 100_000

Id_Positivo = Annotated[int, Field(gt=0, le=MAX_ID)]
Importe = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]


class Item_Venta_DTO(BaseModel):
    """Producto y cantidad pedidos en una venta o devolución."""

    producto_id: Id_Positivo
    cantidad: int = Field(gt=0, le=MAX_CANTIDAD)


# --- Medios de pago (Strategy): el campo `medio` elige la estrategia concreta ---


class Pago_Efectivo_DTO(BaseModel):
    medio: Literal["EFECTIVO"]
    monto_recibido: Importe


class Pago_Tarjeta_DTO(BaseModel):
    medio: Literal["TARJETA"]
    numero_tarjeta: str
    cuotas: StrictInt = Field(description="1, 3, 6 o 12 cuotas")


class Pago_Transferencia_DTO(BaseModel):
    medio: Literal["TRANSFERENCIA"]
    cbu_o_alias: str
    codigo_transaccion: str


Pago_DTO = Annotated[
    Pago_Efectivo_DTO | Pago_Tarjeta_DTO | Pago_Transferencia_DTO,
    Field(discriminator="medio"),
]


# --- Requests ---


class Registrar_Venta_Request_DTO(BaseModel):
    local_id: Id_Positivo
    items: list[Item_Venta_DTO] = Field(min_length=1)
    pago: Pago_DTO


class Registrar_Devolucion_Request_DTO(BaseModel):
    local_id: Id_Positivo
    motivo: str = Field(min_length=1, max_length=255)
    items: list[Item_Venta_DTO] = Field(min_length=1)


# --- Responses ---


class Detalle_Venta_DTO(BaseModel):
    producto_id: int
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class Comprobante_DTO(BaseModel):
    venta_id: int
    numero: int
    numero_formateado: str
    local_id: int
    fecha_emision: str
    total: Decimal
    medio_pago: str
    recargo: Decimal
    total_cobrado: Decimal
    vuelto: Decimal
    detalle_pago: str
    items: list[Detalle_Venta_DTO]


class Venta_DTO(BaseModel):
    id: int
    local_id: int
    fecha_hora: str
    total: Decimal
    medio_pago: str
    total_cobrado: Decimal
    numero_comprobante: str
    detalles: list[Detalle_Venta_DTO]


class Detalle_Devolucion_DTO(BaseModel):
    producto_id: int
    cantidad: int
    precio_unitario: Decimal
    monto: Decimal


class Devolucion_DTO(BaseModel):
    id: int
    venta_id: int
    local_id: int
    fecha_hora: str
    motivo: str
    medio_pago: str
    monto_reintegrado: Decimal
    detalles: list[Detalle_Devolucion_DTO]


class Saldo_Caja_DTO(BaseModel):
    local_id: int
    desde: date
    hasta: date
    cantidad_ventas: int
    total_ventas: Decimal
    cantidad_devoluciones: int
    total_devoluciones: Decimal
    saldo: Decimal
