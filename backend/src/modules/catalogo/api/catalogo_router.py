from typing import Any
from fastapi import APIRouter, Body, HTTPException, Query, status

from modules.catalogo.api.catalogo_controller import Catalogo_Controller

catalogo_router = APIRouter(prefix="/api/catalogo", tags=["Catálogo"])
controller = Catalogo_Controller()


def _resolver_respuesta(resp: Any) -> Any:
    """Traduce el resultado del controlador a respuesta o excepción HTTP de FastAPI."""
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.error)
    return resp.data


# --- Categorías ---

@catalogo_router.post("/categorias", status_code=status.HTTP_201_CREATED)
def crear_categoria(body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.crear_categoria(body))


@catalogo_router.get("/categorias", status_code=status.HTTP_200_OK)
def listar_categorias() -> Any:
    return _resolver_respuesta(controller.listar_categorias())


@catalogo_router.get("/categorias/{categoria_id}", status_code=status.HTTP_200_OK)
def obtener_categoria(categoria_id: int) -> Any:
    return _resolver_respuesta(controller.obtener_categoria(categoria_id))


# --- Proveedores ---

@catalogo_router.post("/proveedores", status_code=status.HTTP_201_CREATED)
def crear_proveedor(body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.crear_proveedor(body))


@catalogo_router.get("/proveedores", status_code=status.HTTP_200_OK)
def listar_proveedores(activos: bool = Query(True)) -> Any:
    return _resolver_respuesta(controller.listar_proveedores(solo_activos=activos))


@catalogo_router.get("/proveedores/{cuit}", status_code=status.HTTP_200_OK)
def obtener_proveedor(cuit: str) -> Any:
    return _resolver_respuesta(controller.obtener_proveedor(cuit))


@catalogo_router.put("/proveedores/{cuit}", status_code=status.HTTP_200_OK)
def actualizar_proveedor(cuit: str, body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.actualizar_proveedor(cuit, body))


@catalogo_router.delete("/proveedores/{cuit}", status_code=status.HTTP_204_NO_CONTENT)
def dar_de_baja_proveedor(cuit: str) -> None:
    resp = controller.dar_de_baja_proveedor(cuit)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.error)


# --- Productos ---

@catalogo_router.post("/productos", status_code=status.HTTP_201_CREATED)
def crear_producto(body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.crear_producto(body))


@catalogo_router.get("/productos", status_code=status.HTTP_200_OK)
def listar_productos(
    activos: bool = Query(True),
    categoria_id: int | None = Query(None),
) -> Any:
    return _resolver_respuesta(controller.listar_productos(solo_activos=activos, categoria_id=categoria_id))


@catalogo_router.get("/productos/{codigo}", status_code=status.HTTP_200_OK)
def obtener_producto(codigo: str) -> Any:
    return _resolver_respuesta(controller.obtener_producto(codigo))


@catalogo_router.patch("/productos/{codigo}/precio", status_code=status.HTTP_200_OK)
def actualizar_precio_producto(codigo: str, body: dict[str, Any] = Body(...)) -> Any:
    return _resolver_respuesta(controller.actualizar_precio_producto(codigo, body))


@catalogo_router.delete("/productos/{codigo}", status_code=status.HTTP_204_NO_CONTENT)
def dar_de_baja_producto(codigo: str) -> None:
    resp = controller.dar_de_baja_producto(codigo)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.error)
