from dataclasses import dataclass


@dataclass(frozen=True)
class Ubicacion_DTO:
    id: int | None
    tipo: str
    nombre: str
    direccion: str
    telefono: str | None
    activo: bool = True


@dataclass(frozen=True)
class Crear_CD_DTO:
    nombre: str
    direccion: str
    telefono: str | None = None


@dataclass(frozen=True)
class Crear_Local_DTO:
    nombre: str
    direccion: str
    telefono: str


@dataclass(frozen=True)
class Actualizar_Ubicacion_DTO:
    nombre: str
    direccion: str
    telefono: str | None = None


@dataclass(frozen=True)
class Stock_DTO:
    id: int | None
    producto_id: int
    ubicacion_id: int
    cantidad_disponible: int
    cantidad_en_transito: int
    nivel_minimo_existencia: int


@dataclass(frozen=True)
class Ingreso_CD_DTO:
    producto_id: int
    cd_id: int
    cantidad: int
    comprobante: str | None = None


@dataclass(frozen=True)
class Alerta_Stock_DTO:
    id: int | None
    stock_id: int
    producto_id: int
    ubicacion_id: int
    cantidad_disponible: int
    nivel_minimo: int
    fecha_emision: str
    leida: bool = False
