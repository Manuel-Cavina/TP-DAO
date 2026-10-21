from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from modules.reportes.application import Reportes_Service
from modules.reportes.dto import (
    Existencia_DTO,
    Merma_DTO,
    Producto_Vendido_DTO,
    Reporte_DTO,
    Tiempo_Transito_DTO,
    Ventas_Medio_Pago_DTO,
)
from modules.reportes.mappers import Reportes_Mapper

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])

# Annotated crea un Query por parámetro: reutilizar un mismo Query(...) en parámetros
# distintos hace que FastAPI los confunda (se queda con el nombre del primero).
Desde = Annotated[date, Query(description="Primer día del período (inclusive)")]
Hasta = Annotated[date, Query(description="Último día del período (inclusive)")]
Id_Opcional = Annotated[int | None, Query(gt=0, le=2**63 - 1)]


def get_reportes_service() -> Reportes_Service:
    return Reportes_Service()


@router.get(
    "/ventas",
    response_model=Reporte_DTO[Ventas_Medio_Pago_DTO],
    summary="1. Ventas e ingresos por período, local y medio de pago",
)
def reporte_ventas(
    desde: Desde,
    hasta: Hasta,
    local_id: Id_Opcional = None,
    service: Reportes_Service = Depends(get_reportes_service),
) -> Reporte_DTO[Ventas_Medio_Pago_DTO]:
    return Reportes_Mapper.a_dto(service.ventas_por_periodo(desde, hasta, local_id), Reportes_Mapper.ventas)


@router.get(
    "/productos-mas-vendidos",
    response_model=Reporte_DTO[Producto_Vendido_DTO],
    summary="2. Productos más vendidos y margen de ganancia o pérdida estimado",
)
def reporte_productos_mas_vendidos(
    desde: Desde,
    hasta: Hasta,
    top: int = Query(10, gt=0, le=100, description="Cantidad de productos a mostrar"),
    service: Reportes_Service = Depends(get_reportes_service),
) -> Reporte_DTO[Producto_Vendido_DTO]:
    return Reportes_Mapper.a_dto(service.productos_mas_vendidos(desde, hasta, top), Reportes_Mapper.producto)


@router.get(
    "/existencias",
    response_model=Reporte_DTO[Existencia_DTO],
    summary="3. Existencias actuales, productos en stock mínimo y valorización",
)
def reporte_existencias(
    ubicacion_id: Id_Opcional = None,
    service: Reportes_Service = Depends(get_reportes_service),
) -> Reporte_DTO[Existencia_DTO]:
    return Reportes_Mapper.a_dto(service.existencias(ubicacion_id), Reportes_Mapper.existencia)


@router.get(
    "/mermas",
    response_model=Reporte_DTO[Merma_DTO],
    summary="4. Bultos rechazados y mermas por rotura de precinto",
)
def reporte_mermas(
    desde: Desde,
    hasta: Hasta,
    local_id: Id_Opcional = None,
    service: Reportes_Service = Depends(get_reportes_service),
) -> Reporte_DTO[Merma_DTO]:
    return Reportes_Mapper.a_dto(service.mermas(desde, hasta, local_id), Reportes_Mapper.merma)


@router.get(
    "/tiempos-transito",
    response_model=Reporte_DTO[Tiempo_Transito_DTO],
    summary="5. Tiempo promedio de tránsito CD → locales",
)
def reporte_tiempos_transito(
    desde: Desde,
    hasta: Hasta,
    service: Reportes_Service = Depends(get_reportes_service),
) -> Reporte_DTO[Tiempo_Transito_DTO]:
    return Reportes_Mapper.a_dto(service.tiempos_transito(desde, hasta), Reportes_Mapper.transito)
