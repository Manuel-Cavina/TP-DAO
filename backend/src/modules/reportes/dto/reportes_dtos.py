from decimal import Decimal
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

Fila_DTO = TypeVar("Fila_DTO", bound=BaseModel)


class Reporte_DTO(BaseModel, Generic[Fila_DTO]):
    """Respuesta común de los reportes: filas, totales y figura Plotly (JSON) para el frontend."""

    filas: list[Fila_DTO]
    totales: dict[str, Decimal | int]
    grafico: dict[str, Any]


class Ventas_Medio_Pago_DTO(BaseModel):
    local_id: int
    local_nombre: str
    medio_pago: str
    cantidad_ventas: int
    total_bruto: Decimal
    cantidad_devoluciones: int
    total_devoluciones: Decimal
    total_neto: Decimal


class Producto_Vendido_DTO(BaseModel):
    producto_id: int
    codigo: str
    nombre: str
    unidades_vendidas: int
    unidades_devueltas: int
    unidades_netas: int
    ingresos: Decimal
    costo: Decimal
    margen: Decimal
    margen_porcentaje: Decimal
    margen_negativo: bool


class Existencia_DTO(BaseModel):
    producto_id: int
    codigo: str
    nombre: str
    ubicacion_id: int
    ubicacion_nombre: str
    cantidad_disponible: int
    cantidad_en_transito: int
    nivel_minimo_existencia: int
    faltante: int
    en_o_bajo_minimo: bool
    valorizacion: Decimal


class Merma_DTO(BaseModel):
    bulto_id: int
    remito_numero: str | None
    local_id: int
    local_nombre: str
    fecha_rechazo: str
    unidades_perdidas: int
    valor_perdido: Decimal
    productos: list[str]


class Tiempo_Transito_DTO(BaseModel):
    local_id: int
    local_nombre: str
    cantidad_bultos: int
    promedio_horas: Decimal
    minimo_horas: Decimal
    maximo_horas: Decimal
