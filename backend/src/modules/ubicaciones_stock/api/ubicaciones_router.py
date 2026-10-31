from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, status

from modules.ubicaciones_stock.application import Ubicacion_Service
from modules.ubicaciones_stock.dto import Ubicacion_DTO, Ubicacion_Request_DTO
from modules.ubicaciones_stock.mappers import Stock_Mapper
from modules.seguridad.api.dependencies import requerir_rol, validar_csrf
from modules.seguridad.domain.usuario import ROL_ADMIN
from modules.seguridad.api.dependencies import requerir_sesion_y_admin_para_escritura


router = APIRouter(
    prefix="/api/ubicaciones",
    tags=["Ubicaciones (CD y Locales)"],
    dependencies=[Depends(requerir_sesion_y_admin_para_escritura)],
)

Ubicacion_Id = Annotated[int, Path(gt=0, le=2**63 - 1, description="ID de la ubicación")]


def get_ubicacion_service() -> Ubicacion_Service:
    return Ubicacion_Service()


@router.get("", response_model=list[Ubicacion_DTO], summary="Listar ubicaciones (P1)")
def listar_ubicaciones(
    tipo: Literal["CD", "LOCAL"] | None = Query(None),
    solo_activas: bool = Query(False),
    q: str | None = Query(None),
    service: Ubicacion_Service = Depends(get_ubicacion_service),
) -> list[Ubicacion_DTO]:
    return [Stock_Mapper.ubicacion_a_dto(u) for u in service.listar(tipo, solo_activas, q=q)]


@router.post(
    "/locales",
    response_model=Ubicacion_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Alta de local: nace con stock en cero de cada producto activo",
)
def crear_local(
    req: Ubicacion_Request_DTO,
    service: Ubicacion_Service = Depends(get_ubicacion_service),
) -> Ubicacion_DTO:
    return Stock_Mapper.ubicacion_a_dto(service.crear_local(req.nombre, req.direccion, req.telefono))


@router.post(
    "/centros-distribucion",
    response_model=Ubicacion_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Alta de Centro de Distribución",
)
def crear_centro_distribucion(
    req: Ubicacion_Request_DTO,
    service: Ubicacion_Service = Depends(get_ubicacion_service),
) -> Ubicacion_DTO:
    return Stock_Mapper.ubicacion_a_dto(service.crear_centro_distribucion(req.nombre, req.direccion, req.telefono))


@router.get("/{ubicacion_id}", response_model=Ubicacion_DTO, summary="Obtener una ubicación")
def obtener_ubicacion(
    ubicacion_id: Ubicacion_Id,
    service: Ubicacion_Service = Depends(get_ubicacion_service),
) -> Ubicacion_DTO:
    return Stock_Mapper.ubicacion_a_dto(service.obtener(ubicacion_id))


@router.put("/{ubicacion_id}", response_model=Ubicacion_DTO, summary="Modificar una ubicación")
def actualizar_ubicacion(
    ubicacion_id: Ubicacion_Id,
    req: Ubicacion_Request_DTO,
    service: Ubicacion_Service = Depends(get_ubicacion_service),
) -> Ubicacion_DTO:
    return Stock_Mapper.ubicacion_a_dto(service.actualizar(ubicacion_id, req.nombre, req.direccion, req.telefono))


@router.delete(
    "/{ubicacion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica: la ubicación conserva su historial de stock, ventas y bultos",
    dependencies=[Depends(requerir_rol(ROL_ADMIN))],
)
def desactivar_ubicacion(
    ubicacion_id: Ubicacion_Id,
    service: Ubicacion_Service = Depends(get_ubicacion_service),
) -> None:
    service.desactivar(ubicacion_id)


@router.post(
    "/{ubicacion_id}/reactivar",
    response_model=Ubicacion_DTO,
    summary="Reactivar un centro o local conservando su identidad e historial",
    dependencies=[Depends(requerir_rol(ROL_ADMIN)), Depends(validar_csrf)],
)
def reactivar_ubicacion(
    ubicacion_id: Ubicacion_Id,
    service: Ubicacion_Service = Depends(get_ubicacion_service),
) -> Ubicacion_DTO:
    return Stock_Mapper.ubicacion_a_dto(service.reactivar(ubicacion_id))
