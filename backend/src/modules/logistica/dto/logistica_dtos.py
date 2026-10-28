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


class Aprobacion_Bulto_DTO(BaseModel):
    """DTO representativo de una aprobación inmutable de bulto (US4 / T042)."""

    id: int | None = None
    bulto_id: int
    actor: str | None = None
    fecha_hora: str | None = None
    observacion: str = ""


class Bulto_DTO(BaseModel):
    """DTO completo de bulto."""

    id: int | None = None
    orden_id: int
    estado: str
    precinto: Precinto_DTO | None = None
    detalles: list[Detalle_Bulto_DTO] = []
    historial: list[Historial_Bulto_DTO] = []
    aprobado: bool = False
    aprobacion: Aprobacion_Bulto_DTO | None = None


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
    orden_id: int | None = None


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
    necesidad_ids: list[Id_Positivo] | None = None
    validar_stock: bool = False


class Crear_Orden_Manual_Request_DTO(BaseModel):
    origen_id: Id_Positivo
    destino_id: Id_Positivo
    items: list[Detalle_Bulto_DTO] = Field(min_length=1)
    necesidad_ids: list[Id_Positivo] | None = None
    validar_stock: bool = False


class Crear_Bulto_Request_DTO(BaseModel):
    items: list[Detalle_Bulto_DTO] = Field(min_length=1)


class Precintar_Bulto_Request_DTO(BaseModel):
    codigo_precinto: str = Field(min_length=1, max_length=50)


class Item_Precintar_Bulto_DTO(BaseModel):
    bulto_id: Id_Positivo
    codigo_precinto: str = Field(min_length=1, max_length=50)


class Precintar_Lote_Request_DTO(BaseModel):
    items: list[Item_Precintar_Bulto_DTO] = Field(min_length=1)


class Aprobar_Bulto_Request_DTO(BaseModel):
    actor: str | None = None
    observacion: str | None = None


class Bloqueo_Bulto_DTO(BaseModel):
    id: int
    motivo: str


class Aprobar_Elegibles_Response_DTO(BaseModel):
    approved: list[int]
    blocked: list[Bloqueo_Bulto_DTO]


class Registrar_Precinto_Request_DTO(BaseModel):
    codigo: str = Field(min_length=1, max_length=50)


class Generar_Remito_Request_DTO(BaseModel):
    numero: str | None = Field(None, min_length=1, max_length=50)
    bultos_ids: list[Id_Positivo] = Field(min_length=1)
    validar_aprobacion: bool = False


class Verificar_Bulto_Request_DTO(BaseModel):
    codigo_precinto_recibido: str | None = None
    esta_intacto: bool = True
    codigo_esperado: str | None = None
    codigo_leido: str | None = None
    resultado: str | None = None  # "INTACTO" | "VIOLADO"
    motivo_rechazo: str = ""
    version: int = 1


class Item_Control_Bulto_Request_DTO(BaseModel):
    """Item individual para control de bulto en lote o individual (US5 / T057)."""

    bulto_id: int
    version: int = 1
    codigo_esperado: str
    codigo_leido: str
    resultado: str  # "INTACTO" | "VIOLADO"
    motivo_rechazo: str = ""


class Control_Bultos_Batch_Request_DTO(BaseModel):
    """Solicitud de control físico de precintos por lote atómico (US5 / T057)."""

    items: list[Item_Control_Bulto_Request_DTO] = Field(min_length=1)


class Item_Control_Bulto_Response_DTO(BaseModel):
    """Resultado individual de control de precinto por bulto (US5 / T057)."""

    bulto_id: int
    resultado: str  # "VERIFICADO" | "RECHAZADO"
    estado_bulto: str
    motivo_rechazo: str = ""


class Control_Bultos_Batch_Response_DTO(BaseModel):
    """Resumen de control por lote atómico de bultos de un remito (US5 / T057)."""

    remito_numero: str
    total_controlados: int
    verificados: int
    rechazados: int
    resultados: list[Item_Control_Bulto_Response_DTO]


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


class Evento_Trazabilidad_DTO(BaseModel):
    id: int | None = None
    tipo_entidad: str
    entidad_id: int
    accion: str
    estado_anterior: str | None = None
    estado_nuevo: str
    actor: str | None = None
    origen_id: int | None = None
    destino_id: int | None = None
    registros_asociados: str | None = None
    motivo_o_evidencia: str | None = None
    fecha_hora: str | None = None


class Trazabilidad_Orden_Response_DTO(BaseModel):
    orden_id: int
    origen_id: int
    destino_id: int
    estado_actual: str
    eventos: list[Evento_Trazabilidad_DTO]


class Item_Busqueda_Orden_DTO(BaseModel):
    id: int
    origen_id: int
    destino_id: int
    estado: str
    fecha: str


class Item_Busqueda_Remito_DTO(BaseModel):
    numero: str
    orden_id: int | None = None
    origen_id: int
    destino_id: int
    estado: str
    fecha_emision: str


class Item_Busqueda_Bulto_DTO(BaseModel):
    id: int | None = None
    orden_id: int
    estado: str
    codigo_precinto: str | None = None


class Busqueda_Logistica_Response_DTO(BaseModel):
    """DTO de respuesta para búsqueda global de trazabilidad logística (US5 / T061)."""

    ordenes: list[Item_Busqueda_Orden_DTO] = []
    remitos: list[Item_Busqueda_Remito_DTO] = []
    bultos: list[Item_Busqueda_Bulto_DTO] = []


class Resumen_Bulto_Remito_DTO(BaseModel):
    id: int | None = None
    estado: str
    precinto_esperado: str | None = None
    precinto_leido: str | None = None
    resultado_control: str | None = None
    motivo_rechazo: str = ""
    detalles: list[Detalle_Bulto_DTO] = []


class Resumen_Control_Precinto_DTO(BaseModel):
    id: int | None = None
    bulto_id: int
    codigo_esperado: str
    codigo_leido: str
    resultado: str
    motivo_rechazo: str = ""
    actor: str = "Operador"
    ubicacion_id: int | None = None
    fecha_hora: str | None = None
    version_bulto: int = 1


class Resumen_Orden_Asociada_DTO(BaseModel):
    id: int
    origen_id: int
    destino_id: int
    estado: str
    fecha: str


class Resumen_Remito_Trazabilidad_Response_DTO(BaseModel):
    """DTO representativo del resumen integral de trazabilidad de un remito (US5 / T061)."""

    numero: str
    orden_id: int | None = None
    origen_id: int
    destino_id: int
    fecha_emision: str
    estado: str
    orden: Resumen_Orden_Asociada_DTO | None = None
    bultos: list[Resumen_Bulto_Remito_DTO] = []
    controles_precintos: list[Resumen_Control_Precinto_DTO] = []
    eventos_trazabilidad: list[Evento_Trazabilidad_DTO] = []
