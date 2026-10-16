from dataclasses import dataclass


@dataclass(frozen=True)
class Categoria_DTO:
    id: int | None
    nombre: str


@dataclass(frozen=True)
class Crear_Categoria_DTO:
    nombre: str


@dataclass(frozen=True)
class Proveedor_DTO:
    id: int | None
    cuit: str
    razon_social: str
    telefono: str
    email: str
    activo: bool = True


@dataclass(frozen=True)
class Crear_Proveedor_DTO:
    cuit: str
    razon_social: str
    telefono: str
    email: str


@dataclass(frozen=True)
class Actualizar_Proveedor_DTO:
    razon_social: str
    telefono: str
    email: str


@dataclass(frozen=True)
class Producto_DTO:
    id: int | None
    codigo: str
    nombre: str
    precio_venta: float
    costo_unitario: float
    categoria_id: int
    proveedor_id: int
    activo: bool = True
    nivel_minimo: int = 1


@dataclass(frozen=True)
class Crear_Producto_DTO:
    codigo: str
    nombre: str
    precio_venta: float
    costo_unitario: float
    categoria_id: int
    proveedor_id: int
    nivel_minimo: int = 1


@dataclass(frozen=True)
class Actualizar_Precio_DTO:
    precio_venta: float
