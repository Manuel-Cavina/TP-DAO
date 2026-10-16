from typing import Any
from pydantic import BaseModel, Field


class Detalle_Bulto_DTO(BaseModel):
    """DTO para el contenido de un bulto."""

    producto_id: str
    cantidad: int = Field(gt=0, description="Cantidad de unidades del producto")


class Historial_Bulto_DTO(BaseModel):
    """DTO para eventos de trazabilidad de un bulto."""

    bulto_id: int | str
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
    orden_id: int | str
    estado: str
    precinto: Precinto_DTO | None = None
    detalles: list[Detalle_Bulto_DTO] = []
    historial: list[Historial_Bulto_DTO] = []


class Detalle_Orden_Reposicion_DTO(BaseModel):
    """DTO representativo de un item en la orden de reposicion."""

    producto_id: str
    cantidad_solicitada: int = Field(gt=0)
    cantidad_enviada: int = Field(ge=0, default=0)


class Orden_Reposicion_DTO(BaseModel):
    """DTO para ordenes de reposicion."""

    id: int | None = None
    origen_id: str
    destino_id: str
    fecha: str
    estado: str
    detalles: list[Detalle_Orden_Reposicion_DTO] = []


class Remito_DTO(BaseModel):
    """DTO para el documento de remito de despacho."""

    numero: str
    origen_id: str
    destino_id: str
    fecha_emision: str
    estado: str
    bultos: list[Bulto_DTO] = []


class Necesidad_Reposicion_DTO(BaseModel):
    """DTO para una necesidad de reposicion detectada."""

    id: int | None = None
    producto_id: str
    local_id: str
    cantidad: int
    estado: str = "PENDIENTE"
    fecha_registro: str | None = None


# --- Requests y Responses especificos para la API ---


class Registrar_Necesidad_Request_DTO(BaseModel):
    producto_id: str
    local_id: str
    cantidad: int = Field(gt=0)


class Consolidar_Orden_Request_DTO(BaseModel):
    local_destino_id: str
    origen_id: str = "CD-CENTRAL"


class Crear_Orden_Manual_Request_DTO(BaseModel):
    origen_id: str
    destino_id: str
    items: list[Detalle_Bulto_DTO]


class Crear_Bulto_Request_DTO(BaseModel):
    items: list[Detalle_Bulto_DTO]


class Precintar_Bulto_Request_DTO(BaseModel):
    codigo_precinto: str


class Registrar_Precinto_Request_DTO(BaseModel):
    codigo: str


class Generar_Remito_Request_DTO(BaseModel):
    numero: str
    bultos_ids: list[int | str]


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
    bulto_id: int | str
    orden_id: int | str
    estado_actual: str
    codigo_precinto: str | None = None
    total_items: int
    eventos: list[dict[str, Any]]
