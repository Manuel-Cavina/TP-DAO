from typing import Annotated, Literal

from pydantic import BaseModel, Field

Id_Positivo = Annotated[int, Field(gt=0, le=2**63 - 1)]
Cantidad = Annotated[int, Field(gt=0, le=1_000_000)]


# --- Requests ---


class Ubicacion_Request_DTO(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    direccion: str = Field(min_length=1, max_length=255)
    telefono: str | None = Field(default=None, max_length=50)


class Ingreso_Mercaderia_Request_DTO(BaseModel):
    producto_id: Id_Positivo
    cd_id: Id_Positivo
    cantidad: Cantidad


class Nivel_Minimo_Request_DTO(BaseModel):
    nivel_minimo_existencia: Cantidad


# --- Responses ---


class Ubicacion_DTO(BaseModel):
    id: int
    tipo: Literal["CD", "LOCAL"]
    nombre: str
    direccion: str
    telefono: str | None
    activo: bool


class Stock_DTO(BaseModel):
    id: int
    producto_id: int
    ubicacion_id: int
    cantidad_disponible: int
    cantidad_en_transito: int
    nivel_minimo_existencia: int
    en_o_bajo_minimo: bool


class Alerta_Stock_DTO(BaseModel):
    id: int
    stock_id: int
    producto_id: int
    ubicacion_id: int
    cantidad_disponible: int
    nivel_minimo: int
    fecha_emision: str
    leida: bool
