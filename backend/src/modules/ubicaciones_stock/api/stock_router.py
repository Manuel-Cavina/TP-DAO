from typing import Any
from fastapi import APIRouter, Body, HTTPException, Query, status

from modules.ubicaciones_stock.api.stock_controller import Ubicaciones_Stock_Controller

stock_router = APIRouter(prefix="/api/stock", tags=["Ubicaciones y Stock"])
controller = Ubicaciones_Stock_Controller()


def _resolver_respuesta(resp: Any) -> Any:
    """Traduce el resultado del controlador a respuesta o excepción HTTP de FastAPI."""
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.error)
    return resp.data


# --- Ubicaciones ---

@stock_router.post("/ubicaciones/cd", status_code=status.HTTP_201_CREATED)
def crear_centro_distribucion(body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.crear_cd(body))


@stock_router.post("/ubicaciones/locales", status_code=status.HTTP_201_CREATED)
def crear_local(body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.crear_local(body))


@stock_router.get("/ubicaciones", status_code=status.HTTP_200_OK)
def listar_ubicaciones(activas: bool = Query(True)) -> Any:
    return _resolver_respuesta(controller.listar_ubicaciones(solo_activas=activas))


@stock_router.get("/ubicaciones/{ubicacion_id}", status_code=status.HTTP_200_OK)
def obtener_ubicacion(ubicacion_id: int) -> Any:
    return _resolver_respuesta(controller.obtener_ubicacion(ubicacion_id))


@stock_router.delete("/ubicaciones/{ubicacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def dar_de_baja_ubicacion(ubicacion_id: int) -> None:
    resp = controller.dar_de_baja_ubicacion(ubicacion_id)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.error)


# --- Stock e Ingresos ---

@stock_router.post("/ingreso-cd", status_code=status.HTTP_200_OK)
def ingresar_mercaderia_cd(body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.ingresar_mercaderia_cd(body))


@stock_router.get("/disponible", status_code=status.HTTP_200_OK)
def consultar_disponible(
    producto_id: int = Query(...),
    ubicacion_id: int = Query(...),
) -> Any:
    return _resolver_respuesta(controller.consultar_disponible(producto_id, ubicacion_id))


@stock_router.get("/ubicacion/{ubicacion_id}", status_code=status.HTTP_200_OK)
def consultar_stock_por_ubicacion(ubicacion_id: int) -> Any:
    return _resolver_respuesta(controller.consultar_stock_por_ubicacion(ubicacion_id))


@stock_router.get("/producto/{producto_id}", status_code=status.HTTP_200_OK)
def consultar_stock_por_producto(producto_id: int) -> Any:
    return _resolver_respuesta(controller.consultar_stock_por_producto(producto_id))


@stock_router.get("/alertas", status_code=status.HTTP_200_OK)
def listar_alertas(
    solo_no_leidas: bool = Query(False),
    ubicacion_id: int | None = Query(None),
) -> Any:
    return _resolver_respuesta(
        controller.listar_alertas(solo_no_leidas=solo_no_leidas, ubicacion_id=ubicacion_id)
    )
