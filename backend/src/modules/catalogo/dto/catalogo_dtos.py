from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

Id_Positivo = Annotated[int, Field(gt=0, le=2**63 - 1)]
Importe = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]


# --- Requests ---


class Categoria_Request_DTO(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)


class Crear_Proveedor_Request_DTO(BaseModel):
    cuit: str = Field(min_length=11, max_length=13, description="11 dígitos, admite guiones")
    razon_social: str = Field(min_length=1, max_length=150)
    telefono: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=150)


class Actualizar_Proveedor_Request_DTO(BaseModel):
    razon_social: str = Field(min_length=1, max_length=150)
    telefono: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=150)


class Actualizar_Producto_Request_DTO(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    precio_venta: Importe
    costo_unitario: Importe
    categoria_id: Id_Positivo
    proveedor_id: Id_Positivo


class Crear_Producto_Request_DTO(Actualizar_Producto_Request_DTO):
    codigo: str = Field(min_length=1, max_length=50)
    nivel_minimo_existencia: int = Field(gt=0, le=1_000_000)


# --- Responses ---


class Categoria_DTO(BaseModel):
    id: int
    nombre: str
    activo: bool


class Proveedor_DTO(BaseModel):
    id: int
    cuit: str
    razon_social: str
    telefono: str
    email: str
    activo: bool


class Producto_DTO(BaseModel):
    id: int
    codigo: str
    nombre: str
    precio_venta: Decimal
    costo_unitario: Decimal
    categoria_id: int
    proveedor_id: int
    activo: bool
