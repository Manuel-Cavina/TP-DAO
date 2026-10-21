from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Query, status

from modules.logistica.application import (
    Despacho_Service,
    Empaquetado_Service,
    Recepcion_Service,
    Reposicion_Service,
    Trazabilidad_Service,
)
from modules.logistica.dto import (
    Bulto_DTO,
    Cierre_Remito_Response_DTO,
    Consolidar_Orden_Request_DTO,
    Crear_Bulto_Request_DTO,
    Crear_Orden_Manual_Request_DTO,
    Generar_Remito_Request_DTO,
    Necesidad_Reposicion_DTO,
    Orden_Reposicion_DTO,
    Precintar_Bulto_Request_DTO,
    Precinto_DTO,
    Registrar_Necesidad_Request_DTO,
    Registrar_Precinto_Request_DTO,
    Remito_DTO,
    Trazabilidad_Bulto_Response_DTO,
    Verificar_Bulto_Request_DTO,
)
from modules.logistica.infrastructure import Stock_Logistica_Adapter
from modules.seguridad.api import requerir_rol
from modules.seguridad.domain import ROL_OPERADOR
from modules.logistica.mappers import (
    Bulto_Mapper,
    Orden_Reposicion_Mapper,
    Precinto_Mapper,
    Remito_Mapper,
)

router = APIRouter(
    prefix="/api/logistica",
    tags=["Logística y Trazabilidad de Bultos"],
    dependencies=[Depends(requerir_rol(ROL_OPERADOR))],
)

Id_Path = Annotated[int, Path(gt=0, le=2**63 - 1)]


# Inyeccion de dependencias desacoplada para FastAPI. Las rutas no capturan BusinessError:
# el handler global traduce cada excepcion tipada a 400, 404 o 409.
# Al publicar Integrante 1 su Stock_Service, solo se reemplaza el adaptador aqui.
def get_reposicion_service() -> Reposicion_Service:
    return Reposicion_Service(Stock_Logistica_Adapter())


def get_empaquetado_service() -> Empaquetado_Service:
    return Empaquetado_Service(Stock_Logistica_Adapter())


def get_despacho_service() -> Despacho_Service:
    return Despacho_Service(Stock_Logistica_Adapter())


def get_recepcion_service() -> Recepcion_Service:
    return Recepcion_Service(Stock_Logistica_Adapter())


def get_trazabilidad_service() -> Trazabilidad_Service:
    return Trazabilidad_Service()


# -------------------------------------------------------------------------
# Necesidades de Reposición y Órdenes (P3)
# -------------------------------------------------------------------------


@router.post(
    "/necesidades",
    status_code=status.HTTP_201_CREATED,
    summary="Registrar necesidad de reposicion (usado por Observer de Stock o carga manual)",
)
def registrar_necesidad(
    req: Registrar_Necesidad_Request_DTO,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> dict[str, Any]:
    nid = service.registrar_necesidad(
        producto_id=req.producto_id,
        local_id=req.local_id,
        cantidad=req.cantidad,
    )
    return {
        "mensaje": (
            "Necesidad registrada correctamente."
            if nid
            else "Ya existia una necesidad pendiente para ese producto y local."
        ),
        "id": nid,
    }


@router.get(
    "/necesidades",
    response_model=list[Necesidad_Reposicion_DTO],
    summary="Listar necesidades pendientes",
)
def listar_necesidades(
    local_id: int | None = Query(None, gt=0, le=2**63 - 1, description="Filtrar por local destino"),
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> list[Necesidad_Reposicion_DTO]:
    pendientes = service.listar_necesidades_pendientes(local_id)
    return [
        Necesidad_Reposicion_DTO(
            id=p["id"],
            producto_id=p["producto_id"],
            local_id=p["local_id"],
            cantidad=p["cantidad"],
            estado=p["estado"],
            fecha_registro=p["fecha_registro"],
        )
        for p in pendientes
    ]


@router.post(
    "/ordenes/consolidar",
    response_model=Orden_Reposicion_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Consolidar necesidades pendientes en una Orden de Reposicion (P3)",
)
def consolidar_orden(
    req: Consolidar_Orden_Request_DTO,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> Orden_Reposicion_DTO:
    orden = service.consolidar_necesidades_en_orden(
        local_destino_id=req.local_destino_id,
        origen_id=req.origen_id,
    )
    return Orden_Reposicion_Mapper.a_dto(orden)


@router.post(
    "/ordenes",
    response_model=Orden_Reposicion_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una orden de reposicion manualmente",
)
def crear_orden_manual(
    req: Crear_Orden_Manual_Request_DTO,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> Orden_Reposicion_DTO:
    orden = service.crear_orden_manual(
        origen_id=req.origen_id,
        destino_id=req.destino_id,
        items=[it.model_dump() for it in req.items],
    )
    return Orden_Reposicion_Mapper.a_dto(orden)


@router.get(
    "/ordenes",
    response_model=list[Orden_Reposicion_DTO],
    summary="Listar ordenes de reposicion",
)
def listar_ordenes(
    estado: str | None = Query(None, description="Filtrar por estado"),
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> list[Orden_Reposicion_DTO]:
    ordenes = service.listar_ordenes(estado)
    return [Orden_Reposicion_Mapper.a_dto(o) for o in ordenes]


@router.get(
    "/ordenes/{orden_id}",
    response_model=Orden_Reposicion_DTO,
    summary="Obtener una orden de reposicion por ID",
)
def obtener_orden(
    orden_id: Id_Path,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> Orden_Reposicion_DTO:
    orden = service.obtener_orden(orden_id)
    return Orden_Reposicion_Mapper.a_dto(orden)


@router.get(
    "/ordenes/{orden_id}/bultos",
    response_model=list[Bulto_DTO],
    summary="Listar bultos armados para una orden",
)
def listar_bultos_por_orden(
    orden_id: Id_Path,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> list[Bulto_DTO]:
    bultos = service.listar_bultos_por_orden(orden_id)
    return [Bulto_Mapper.a_dto(b) for b in bultos]


# -------------------------------------------------------------------------
# Empaquetado y Bultos (P4)
# -------------------------------------------------------------------------


@router.post(
    "/precintos",
    response_model=Precinto_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un nuevo precinto disponible",
)
def registrar_precinto(
    req: Registrar_Precinto_Request_DTO,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Precinto_DTO:
    precinto = service.registrar_precinto(req.codigo)
    return Precinto_Mapper.a_dto(precinto)


@router.post(
    "/ordenes/{orden_id}/bultos",
    response_model=Bulto_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Empaquetar mercaderia en un nuevo bulto en preparacion (P4)",
)
def crear_bulto(
    orden_id: Id_Path,
    req: Crear_Bulto_Request_DTO,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Bulto_DTO:
    bulto = service.crear_bulto(
        orden_id=orden_id,
        items=[it.model_dump() for it in req.items],
    )
    return Bulto_Mapper.a_dto(bulto)


@router.post(
    "/bultos/{bulto_id}/precintar",
    response_model=Bulto_DTO,
    summary="Precintar bulto (State: PREPARADO -> PRECINTADO)",
)
def precintar_bulto(
    bulto_id: Id_Path,
    req: Precintar_Bulto_Request_DTO,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Bulto_DTO:
    bulto = service.precintar_bulto(
        bulto_id=bulto_id,
        codigo_precinto=req.codigo_precinto,
    )
    return Bulto_Mapper.a_dto(bulto)


@router.get(
    "/bultos/{bulto_id}",
    response_model=Bulto_DTO,
    summary="Obtener un bulto por su ID",
)
def obtener_bulto(
    bulto_id: Id_Path,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Bulto_DTO:
    bulto = service.obtener_bulto(bulto_id)
    return Bulto_Mapper.a_dto(bulto)


# -------------------------------------------------------------------------
# Remitos y Despacho (P4 y P5)
# -------------------------------------------------------------------------


@router.post(
    "/remitos",
    response_model=Remito_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Generar un nuevo remito con bultos precintados",
)
def generar_remito(
    orden_id: int = Query(..., gt=0, le=2**63 - 1, description="ID de la orden de reposicion"),
    req: Generar_Remito_Request_DTO = ...,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Remito_DTO:
    remito = service.generar_remito(
        numero=req.numero,
        orden_id=orden_id,
        bultos_ids=req.bultos_ids,
    )
    return Remito_Mapper.a_dto(remito)


@router.get(
    "/remitos",
    response_model=list[Remito_DTO],
    summary="Listar todos los remitos",
)
def listar_remitos(
    service: Despacho_Service = Depends(get_despacho_service),
) -> list[Remito_DTO]:
    remitos = service.listar_remitos()
    return [Remito_Mapper.a_dto(r) for r in remitos]


@router.get(
    "/remitos/{numero}",
    response_model=Remito_DTO,
    summary="Obtener un remito por su numero",
)
def obtener_remito(
    numero: str,
    service: Despacho_Service = Depends(get_despacho_service),
) -> Remito_DTO:
    remito = service.obtener_remito(numero)
    return Remito_Mapper.a_dto(remito)


@router.post(
    "/remitos/{numero}/despachar",
    response_model=Remito_DTO,
    summary="Despachar remito completo (P5, bultos a EN_TRANSITO)",
)
def despachar_remito(
    numero: str,
    service: Despacho_Service = Depends(get_despacho_service),
) -> Remito_DTO:
    remito = service.despachar_remito(numero)
    return Remito_Mapper.a_dto(remito)


# -------------------------------------------------------------------------
# Recepción, Verificación y Cierre de Remito (P6 y Regla V1)
# -------------------------------------------------------------------------


@router.post(
    "/remitos/{numero}/recibir",
    response_model=Remito_DTO,
    summary="Registrar recepcion de remito en destino (P6, bultos a RECIBIDO)",
)
def recibir_remito(
    numero: str,
    service: Recepcion_Service = Depends(get_recepcion_service),
) -> Remito_DTO:
    remito = service.recibir_remito(numero)
    return Remito_Mapper.a_dto(remito)


@router.post(
    "/bultos/{bulto_id}/verificar",
    response_model=Bulto_DTO,
    summary="Verificar precinto fisico de un bulto (State: RECIBIDO -> VERIFICADO o RECHAZADO)",
)
def verificar_bulto(
    bulto_id: Id_Path,
    req: Verificar_Bulto_Request_DTO,
    service: Recepcion_Service = Depends(get_recepcion_service),
) -> Bulto_DTO:
    bulto = service.verificar_bulto(
        bulto_id=bulto_id,
        codigo_precinto_recibido=req.codigo_precinto_recibido,
        esta_intacto=req.esta_intacto,
    )
    return Bulto_Mapper.a_dto(bulto)


@router.post(
    "/remitos/{numero}/cerrar",
    response_model=Cierre_Remito_Response_DTO,
    summary="Cerrar remito e impactar stock vendible o merma (Regla V1)",
)
def cerrar_remito(
    numero: str,
    service: Recepcion_Service = Depends(get_recepcion_service),
) -> Cierre_Remito_Response_DTO:
    resultado = service.cerrar_remito(numero)
    return Cierre_Remito_Response_DTO(**resultado)


# -------------------------------------------------------------------------
# Trazabilidad Inmutable (Regla V2)
# -------------------------------------------------------------------------


@router.get(
    "/bultos/{bulto_id}/trazabilidad",
    response_model=Trazabilidad_Bulto_Response_DTO,
    summary="Consultar trazabilidad inmutable y linea de tiempo de un bulto (V2)",
)
def consultar_trazabilidad(
    bulto_id: Id_Path,
    service: Trazabilidad_Service = Depends(get_trazabilidad_service),
) -> Trazabilidad_Bulto_Response_DTO:
    resumen = service.consultar_resumen_trazabilidad(bulto_id)
    return Trazabilidad_Bulto_Response_DTO(**resumen)
