from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from modules.ubicaciones_stock.application import Alerta_Stock_Service, Stock_Service
from modules.ubicaciones_stock.dto import (
    Alerta_Stock_DTO,
    Ingreso_Mercaderia_Request_DTO,
    Nivel_Minimo_Request_DTO,
    Stock_DTO,
)
from modules.ubicaciones_stock.mappers import Stock_Mapper
from modules.seguridad.api.dependencies import obtener_usuario_actual, requerir_rol
from modules.seguridad.domain.usuario import ROL_ADMIN


router = APIRouter(
    prefix="/api/stock",
    tags=["Stock e Inventario"],
    # Lectura y marcar alertas como leídas: cualquier usuario con sesión (la campana también la ve el Operador).
    dependencies=[Depends(obtener_usuario_actual)],
)
Solo_Admin = [Depends(requerir_rol(ROL_ADMIN))]

Id_Path = Annotated[int, Path(gt=0, le=2**63 - 1)]
# Annotated crea un Query por parámetro: reutilizar un mismo Query(...) en dos parámetros
# hace que FastAPI los confunda (se queda con el nombre del primero).
Id_Opcional = Annotated[int | None, Query(gt=0, le=2**63 - 1)]


def get_stock_service() -> Stock_Service:
    return Stock_Service()


def get_alerta_service() -> Alerta_Stock_Service:
    return Alerta_Stock_Service()


@router.get("", response_model=list[Stock_DTO], summary="Existencias por ubicación y/o producto")
def listar_stock(
    ubicacion_id: Id_Opcional = None,
    producto_id: Id_Opcional = None,
    solo_bajo_minimo: bool = Query(False, description="Solo stock en o bajo el nivel mínimo"),
    service: Stock_Service = Depends(get_stock_service),
) -> list[Stock_DTO]:
    return [Stock_Mapper.stock_a_dto(s) for s in service.listar(ubicacion_id, producto_id, solo_bajo_minimo)]


@router.post(
    "/ingresos",
    response_model=Stock_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Ingreso de mercadería del proveedor (solo al Centro de Distribución)",
    dependencies=Solo_Admin,
)
def ingresar_mercaderia(
    req: Ingreso_Mercaderia_Request_DTO,
    service: Stock_Service = Depends(get_stock_service),
) -> Stock_DTO:
    return Stock_Mapper.stock_a_dto(service.ingresar_mercaderia_cd(req.producto_id, req.cd_id, req.cantidad))


@router.get("/alertas", response_model=list[Alerta_Stock_DTO], summary="Alertas de stock bajo (Observer)")
def listar_alertas(
    leida: bool | None = Query(None),
    ubicacion_id: Id_Opcional = None,
    service: Alerta_Stock_Service = Depends(get_alerta_service),
) -> list[Alerta_Stock_DTO]:
    return [Stock_Mapper.alerta_a_dto(a) for a in service.listar(leida, ubicacion_id)]


@router.post("/alertas/{alerta_id}/leer", response_model=Alerta_Stock_DTO, summary="Marcar una alerta como leída")
def marcar_alerta_leida(
    alerta_id: Id_Path,
    service: Alerta_Stock_Service = Depends(get_alerta_service),
) -> Alerta_Stock_DTO:
    return Stock_Mapper.alerta_a_dto(service.marcar_leida(alerta_id))


@router.get("/{producto_id}/{ubicacion_id}", response_model=Stock_DTO, summary="Stock de un producto en una ubicación")
def consultar_stock(
    producto_id: Id_Path,
    ubicacion_id: Id_Path,
    service: Stock_Service = Depends(get_stock_service),
) -> Stock_DTO:
    return Stock_Mapper.stock_a_dto(service.consultar_stock(producto_id, ubicacion_id))


@router.put(
    "/{producto_id}/{ubicacion_id}/nivel-minimo",
    response_model=Stock_DTO,
    summary="Modificar el nivel mínimo de existencia",
    dependencies=Solo_Admin,
)
def actualizar_nivel_minimo(
    producto_id: Id_Path,
    ubicacion_id: Id_Path,
    req: Nivel_Minimo_Request_DTO,
    service: Stock_Service = Depends(get_stock_service),
) -> Stock_DTO:
    stock = service.actualizar_nivel_minimo(producto_id, ubicacion_id, req.nivel_minimo_existencia)
    return Stock_Mapper.stock_a_dto(stock)
