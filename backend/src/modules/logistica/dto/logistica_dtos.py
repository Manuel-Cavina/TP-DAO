from typing import Annotated, Any

from pydantic import BaseModel, Field

# Ids de productos y ubicaciones (Integrante 1) y de entidades propias: enteros de 64 bits.
Id_Positivo = Annotated[int, Field(gt=0, le=2**63 - 1)]


class Detalle_Bulto_DTO(BaseModel):
    """DTO para el contenido de un bulto."""

    producto_id: Id_Positivo
    cantidad: int = Field(gt=0, le=1_000_000, description="Cantidad de unidades del producto")


class Historial_Bulto_DTO(BaseModel):
    """DTO para eventos de trazabilidad de un bulto."""

    bulto_id: int | None
    estado_anterior: str
    estado_nuevo: str
    fecha_hora: str
    observacion: str = ""


class Precinto_DTO(BaseModel):
    """DTO representativo de un precinto de seguridad."""

    codigo: str
    esta_intacto: bool = True


class Bulto_DTO(BaseModel):
    """DTO completo de bulto."""

    id: int | None = None
    orden_id: int
    estado: str
    precinto: Precinto_DTO | None = None
    detalles: list[Detalle_Bulto_DTO] = []
    historial: list[Historial_Bulto_DTO] = []


class Detalle_Orden_Reposicion_DTO(BaseModel):
    """DTO representativo de un item en la orden de reposicion."""

    producto_id: Id_Positivo
    cantidad_solicitada: int = Field(gt=0)
    cantidad_enviada: int = Field(ge=0, default=0)


class Orden_Reposicion_DTO(BaseModel):
    """DTO para ordenes de reposicion."""

    id: int | None = None
    origen_id: Id_Positivo
    destino_id: Id_Positivo
    fecha: str
    estado: str
    detalles: list[Detalle_Orden_Reposicion_DTO] = []


class Remito_DTO(BaseModel):
    """DTO para el documento de remito de despacho."""

    numero: str
    origen_id: Id_Positivo
    destino_id: Id_Positivo
    fecha_emision: str
    estado: str
    bultos: list[Bulto_DTO] = []


class Necesidad_Reposicion_DTO(BaseModel):
    """DTO para una necesidad de reposicion detectada."""

    id: int | None = None
    producto_id: Id_Positivo
    local_id: Id_Positivo
    cantidad: int
    estado: str = "PENDIENTE"
    fecha_registro: str | None = None


# --- Requests y Responses especificos para la API ---


class Registrar_Necesidad_Request_DTO(BaseModel):
    producto_id: Id_Positivo
    local_id: Id_Positivo
    cantidad: int = Field(gt=0, le=1_000_000)


class Consolidar_Orden_Request_DTO(BaseModel):
    local_destino_id: Id_Positivo
    origen_id: Id_Positivo


class Crear_Orden_Manual_Request_DTO(BaseModel):
    origen_id: Id_Positivo
    destino_id: Id_Positivo
    items: list[Detalle_Bulto_DTO] = Field(min_length=1)


class Crear_Bulto_Request_DTO(BaseModel):
    items: list[Detalle_Bulto_DTO] = Field(min_length=1)


class Precintar_Bulto_Request_DTO(BaseModel):
    codigo_precinto: str = Field(min_length=1, max_length=50)


class Registrar_Precinto_Request_DTO(BaseModel):
    codigo: str = Field(min_length=1, max_length=50)


class Generar_Remito_Request_DTO(BaseModel):
    numero: str = Field(min_length=1, max_length=50)
    bultos_ids: list[Id_Positivo] = Field(min_length=1)


class Verificar_Bulto_Request_DTO(BaseModel):
    codigo_precinto_recibido: str
    esta_intacto: bool = True


class Cierre_Remito_Response_DTO(BaseModel):
    remito_numero: str
    estado: str
    bultos_verificados: int
    bultos_rechazados: int
    unidades_acreditadas: int
    unidades_merma: int


class Trazabilidad_Bulto_Response_DTO(BaseModel):
    bulto_id: int
    orden_id: int
    estado_actual: str
    codigo_precinto: str | None = None
    total_items: int
    eventos: list[dict[str, Any]]
