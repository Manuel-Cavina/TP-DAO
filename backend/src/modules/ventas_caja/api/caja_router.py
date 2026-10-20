from datetime import date

from fastapi import APIRouter, Depends, Path, Query

from modules.ventas_caja.application import Caja_Service
from modules.ventas_caja.dto import MAX_ID, Saldo_Caja_DTO
from modules.ventas_caja.infrastructure import Stock_Venta_Adapter
from modules.ventas_caja.mappers import Saldo_Caja_Mapper

router = APIRouter(prefix="/api/caja", tags=["Caja del Local"])


def get_caja_service() -> Caja_Service:
    return Caja_Service(stock=Stock_Venta_Adapter())


@router.get(
    "/{local_id}",
    response_model=Saldo_Caja_DTO,
    summary="Saldo de caja del local: ventas cobradas menos devoluciones reintegradas",
)
def consultar_saldo(
    local_id: int = Path(gt=0, le=MAX_ID, description="ID del local"),
    desde: date = Query(..., description="Primer día del período (inclusive)"),
    hasta: date = Query(..., description="Último día del período (inclusive)"),
    service: Caja_Service = Depends(get_caja_service),
) -> Saldo_Caja_DTO:
    return Saldo_Caja_Mapper.a_dto(service.calcular_saldo(local_id, desde, hasta))
