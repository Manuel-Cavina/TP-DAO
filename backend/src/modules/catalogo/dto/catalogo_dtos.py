from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, Field, field_validator, model_validator

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


class Item_Actualizacion_Masiva_DTO(BaseModel):
    codigo: str | None = Field(None, min_length=1, max_length=50)
    producto_id: Id_Positivo | None = None
    nombre: str | None = Field(None, min_length=1, max_length=150)
    precio_venta: Importe | None = None
    costo_unitario: Importe | None = None
    categoria_id: Id_Positivo | None = None
    proveedor_id: Id_Positivo | None = None
    activo: bool | None = None
    nivel_minimo: int | None = Field(None, gt=0, le=1_000_000)
    nivel_minimo_existencia: int | None = Field(None, gt=0, le=1_000_000)

    @field_validator("codigo", mode="before")
    @classmethod
    def sanitizar_codigo(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            return v if v else None
        return v

    @model_validator(mode="after")
    def resolver_minimo_e_identificador(self) -> "Item_Actualizacion_Masiva_DTO":
        if self.nivel_minimo is None and self.nivel_minimo_existencia is not None:
            self.nivel_minimo = self.nivel_minimo_existencia
        elif self.nivel_minimo_existencia is None and self.nivel_minimo is not None:
            self.nivel_minimo_existencia = self.nivel_minimo
        if not self.codigo and self.producto_id is None:
            raise ValueError("Cada elemento debe incluir 'codigo' o 'producto_id'.")
        return self


class Actualizacion_Masiva_Request_DTO(BaseModel):
    actualizaciones: list[Item_Actualizacion_Masiva_DTO] = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def normalizar_payload(cls, data: Any) -> Any:
        if isinstance(data, list):
            return {"actualizaciones": data}
        if isinstance(data, dict):
            if "actualizaciones" not in data and "items" in data:
                data = dict(data)
                data["actualizaciones"] = data["items"]
        return data


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


class Actualizacion_Masiva_Response_DTO(BaseModel):
    actualizados: int
    productos: list[Producto_DTO]
    mensaje: str = "Actualización masiva completada con éxito."
