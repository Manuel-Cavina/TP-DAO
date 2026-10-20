from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from modules.ventas_caja.application import Devolucion_Service, Venta_Service
from modules.ventas_caja.dto import (
    MAX_ID,
    Comprobante_DTO,
    Devolucion_DTO,
    Registrar_Devolucion_Request_DTO,
    Registrar_Venta_Request_DTO,
    Venta_DTO,
)
from modules.ventas_caja.infrastructure import Catalogo_Venta_Adapter, Stock_Venta_Adapter
from modules.ventas_caja.mappers import Devolucion_Mapper, Pago_Mapper, Venta_Mapper

router = APIRouter(prefix="/api/ventas", tags=["Ventas, Cobros y Devoluciones"])

Venta_Id = Annotated[int, Path(gt=0, le=MAX_ID, description="ID de la venta")]


# Inyección de dependencias: al publicar Integrante 1 su Stock_Service y su servicio
# de catálogo, solo se reemplazan los adaptadores en estas funciones.
def get_venta_service() -> Venta_Service:
    return Venta_Service(stock=Stock_Venta_Adapter(), catalogo=Catalogo_Venta_Adapter())


def get_devolucion_service() -> Devolucion_Service:
    return Devolucion_Service(stock=Stock_Venta_Adapter())


# -------------------------------------------------------------------------
# Ventas, cobro (Strategy) y comprobante (P7, regla V3)
# -------------------------------------------------------------------------


@router.post(
    "",
    response_model=Venta_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar y cobrar una venta en un local (P7, V3)",
)
def registrar_venta(
    req: Registrar_Venta_Request_DTO,
    service: Venta_Service = Depends(get_venta_service),
) -> Venta_DTO:
    venta = service.registrar_venta(
        local_id=req.local_id,
        items=[(item.producto_id, item.cantidad) for item in req.items],
        estrategia=Pago_Mapper.a_estrategia(req.pago),
    )
    return Venta_Mapper.a_dto(venta)


@router.get("", response_model=list[Venta_DTO], summary="Listar ventas por local y período")
def listar_ventas(
    local_id: int | None = Query(None, gt=0, le=MAX_ID, description="Filtrar por local"),
    desde: datetime | None = Query(None, description="Fecha y hora mínima (inclusive)"),
    hasta: datetime | None = Query(None, description="Fecha y hora máxima (inclusive)"),
    service: Venta_Service = Depends(get_venta_service),
) -> list[Venta_DTO]:
    return [Venta_Mapper.a_dto(v) for v in service.listar_ventas(local_id, desde, hasta)]


@router.get("/{venta_id}", response_model=Venta_DTO, summary="Obtener una venta por su ID")
def obtener_venta(
    venta_id: Venta_Id,
    service: Venta_Service = Depends(get_venta_service),
) -> Venta_DTO:
    return Venta_Mapper.a_dto(service.obtener_venta(venta_id))


@router.get(
    "/{venta_id}/comprobante",
    response_model=Comprobante_DTO,
    summary="Obtener el comprobante emitido de una venta",
)
def obtener_comprobante(
    venta_id: Venta_Id,
    service: Venta_Service = Depends(get_venta_service),
) -> Comprobante_DTO:
    return Venta_Mapper.a_comprobante_dto(service.obtener_venta(venta_id))


# -------------------------------------------------------------------------
# Devoluciones (regla V5)
# -------------------------------------------------------------------------


@router.post(
    "/{venta_id}/devoluciones",
    response_model=Devolucion_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una devolución parcial o total de la venta (V5)",
)
def registrar_devolucion(
    venta_id: Venta_Id,
    req: Registrar_Devolucion_Request_DTO,
    service: Devolucion_Service = Depends(get_devolucion_service),
) -> Devolucion_DTO:
    devolucion = service.registrar_devolucion(
        venta_id=venta_id,
        local_id=req.local_id,
        items=[(item.producto_id, item.cantidad) for item in req.items],
        motivo=req.motivo,
    )
    return Devolucion_Mapper.a_dto(devolucion)


@router.get(
    "/{venta_id}/devoluciones",
    response_model=list[Devolucion_DTO],
    summary="Listar las devoluciones de una venta",
)
def listar_devoluciones(
    venta_id: Venta_Id,
    service: Devolucion_Service = Depends(get_devolucion_service),
) -> list[Devolucion_DTO]:
    return [Devolucion_Mapper.a_dto(d) for d in service.listar_por_venta(venta_id)]
