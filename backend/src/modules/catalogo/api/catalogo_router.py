from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from modules.catalogo.application import Categoria_Service, Producto_Service, Proveedor_Service
from modules.catalogo.dto import (
    Actualizacion_Masiva_Request_DTO,
    Actualizacion_Masiva_Response_DTO,
    Actualizar_Producto_Request_DTO,
    Actualizar_Proveedor_Request_DTO,
    Categoria_DTO,
    Categoria_Request_DTO,
    Crear_Producto_Request_DTO,
    Crear_Proveedor_Request_DTO,
    Producto_DTO,
    Proveedor_DTO,
)
from modules.catalogo.mappers import Catalogo_Mapper
from modules.ubicaciones_stock.application import Stock_Service
from modules.seguridad.api.dependencies import requerir_sesion_y_admin_para_escritura


router = APIRouter(
    prefix="/api/catalogo",
    tags=["Catálogo"],
    dependencies=[Depends(requerir_sesion_y_admin_para_escritura)],
)

Id_Path = Annotated[int, Path(gt=0, le=2**63 - 1)]


def get_categoria_service() -> Categoria_Service:
    return Categoria_Service()


def get_proveedor_service() -> Proveedor_Service:
    return Proveedor_Service()


def get_producto_service() -> Producto_Service:
    # Stock_Service implementa el puerto Inicializador_Stock_Contract del catálogo.
    return Producto_Service(inicializador_stock=Stock_Service())


# -------------------------------------------------------------------------
# Categorías
# -------------------------------------------------------------------------


@router.get("/categorias", response_model=list[Categoria_DTO], summary="Listar categorías")
def listar_categorias(
    solo_activas: bool = Query(False),
    q: str | None = Query(None, description="Término de búsqueda"),
    service: Categoria_Service = Depends(get_categoria_service),
) -> list[Categoria_DTO]:
    return [Catalogo_Mapper.categoria_a_dto(c) for c in service.listar(solo_activas, q=q)]


@router.post("/categorias", response_model=Categoria_DTO, status_code=status.HTTP_201_CREATED, summary="Alta de categoría")
def crear_categoria(
    req: Categoria_Request_DTO,
    service: Categoria_Service = Depends(get_categoria_service),
) -> Categoria_DTO:
    return Catalogo_Mapper.categoria_a_dto(service.crear(req.nombre))


@router.get("/categorias/{categoria_id}", response_model=Categoria_DTO, summary="Obtener categoría")
def obtener_categoria(
    categoria_id: Id_Path,
    service: Categoria_Service = Depends(get_categoria_service),
) -> Categoria_DTO:
    return Catalogo_Mapper.categoria_a_dto(service.obtener(categoria_id))


@router.put("/categorias/{categoria_id}", response_model=Categoria_DTO, summary="Renombrar categoría")
def renombrar_categoria(
    categoria_id: Id_Path,
    req: Categoria_Request_DTO,
    service: Categoria_Service = Depends(get_categoria_service),
) -> Categoria_DTO:
    return Catalogo_Mapper.categoria_a_dto(service.renombrar(categoria_id, req.nombre))


@router.delete("/categorias/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Baja lógica de categoría")
def desactivar_categoria(
    categoria_id: Id_Path,
    service: Categoria_Service = Depends(get_categoria_service),
) -> None:
    service.desactivar(categoria_id)


# -------------------------------------------------------------------------
# Proveedores
# -------------------------------------------------------------------------


@router.get("/proveedores", response_model=list[Proveedor_DTO], summary="Listar proveedores")
def listar_proveedores(
    solo_activos: bool = Query(False),
    q: str | None = Query(None, description="Término de búsqueda"),
    service: Proveedor_Service = Depends(get_proveedor_service),
) -> list[Proveedor_DTO]:
    return [Catalogo_Mapper.proveedor_a_dto(p) for p in service.listar(solo_activos, q=q)]


@router.post(
    "/proveedores",
    response_model=Proveedor_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Alta de proveedor (CUIT único, V4)",
)
def crear_proveedor(
    req: Crear_Proveedor_Request_DTO,
    service: Proveedor_Service = Depends(get_proveedor_service),
) -> Proveedor_DTO:
    proveedor = service.crear(req.cuit, req.razon_social, req.telefono, req.email)
    return Catalogo_Mapper.proveedor_a_dto(proveedor)


@router.get("/proveedores/{proveedor_id}", response_model=Proveedor_DTO, summary="Obtener proveedor")
def obtener_proveedor(
    proveedor_id: Id_Path,
    service: Proveedor_Service = Depends(get_proveedor_service),
) -> Proveedor_DTO:
    return Catalogo_Mapper.proveedor_a_dto(service.obtener(proveedor_id))


@router.put("/proveedores/{proveedor_id}", response_model=Proveedor_DTO, summary="Modificar proveedor")
def actualizar_proveedor(
    proveedor_id: Id_Path,
    req: Actualizar_Proveedor_Request_DTO,
    service: Proveedor_Service = Depends(get_proveedor_service),
) -> Proveedor_DTO:
    proveedor = service.actualizar(proveedor_id, req.razon_social, req.telefono, req.email)
    return Catalogo_Mapper.proveedor_a_dto(proveedor)


@router.delete("/proveedores/{proveedor_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Baja lógica de proveedor")
def desactivar_proveedor(
    proveedor_id: Id_Path,
    service: Proveedor_Service = Depends(get_proveedor_service),
) -> None:
    service.desactivar(proveedor_id)


# -------------------------------------------------------------------------
# Productos
# -------------------------------------------------------------------------


@router.get("/productos", response_model=list[Producto_DTO], summary="Listar productos")
def listar_productos(
    solo_activos: bool = Query(False),
    q: str | None = Query(None, description="Término de búsqueda"),
    categoria_id: int | None = Query(None, gt=0, le=2**63 - 1),
    service: Producto_Service = Depends(get_producto_service),
) -> list[Producto_DTO]:
    return [Catalogo_Mapper.producto_a_dto(p) for p in service.listar(solo_activos, categoria_id, q=q)]


@router.post(
    "/productos",
    response_model=Producto_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Alta de producto (código único, V4); crea su stock en cero en cada ubicación",
)
def crear_producto(
    req: Crear_Producto_Request_DTO,
    service: Producto_Service = Depends(get_producto_service),
) -> Producto_DTO:
    producto = service.crear(
        codigo=req.codigo,
        nombre=req.nombre,
        precio_venta=req.precio_venta,
        costo_unitario=req.costo_unitario,
        categoria_id=req.categoria_id,
        proveedor_id=req.proveedor_id,
        nivel_minimo_existencia=req.nivel_minimo_existencia,
    )
    return Catalogo_Mapper.producto_a_dto(producto)


@router.post(
    "/productos/actualizacion-masiva",
    response_model=Actualizacion_Masiva_Response_DTO,
    status_code=status.HTTP_200_OK,
    summary="Actualización masiva atómica de productos y stocks mínimos",
)
def actualizacion_masiva_productos(
    req: Actualizacion_Masiva_Request_DTO,
    service: Producto_Service = Depends(get_producto_service),
) -> Actualizacion_Masiva_Response_DTO:
    actualizados = service.actualizar_masivo(req.actualizaciones)
    return Actualizacion_Masiva_Response_DTO(
        actualizados=len(actualizados),
        productos=[Catalogo_Mapper.producto_a_dto(p) for p in actualizados],
    )


@router.get("/productos/{producto_id}", response_model=Producto_DTO, summary="Obtener producto")
def obtener_producto(
    producto_id: Id_Path,
    service: Producto_Service = Depends(get_producto_service),
) -> Producto_DTO:
    return Catalogo_Mapper.producto_a_dto(service.obtener(producto_id))


@router.put(
    "/productos/{producto_id}",
    response_model=Producto_DTO,
    summary="Modificar producto (el nuevo precio no afecta ventas registradas)",
)
def actualizar_producto(
    producto_id: Id_Path,
    req: Actualizar_Producto_Request_DTO,
    service: Producto_Service = Depends(get_producto_service),
) -> Producto_DTO:
    producto = service.actualizar(
        producto_id,
        req.nombre,
        req.precio_venta,
        req.costo_unitario,
        req.categoria_id,
        req.proveedor_id,
    )
    return Catalogo_Mapper.producto_a_dto(producto)


@router.delete("/productos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Baja lógica de producto")
def desactivar_producto(
    producto_id: Id_Path,
    service: Producto_Service = Depends(get_producto_service),
) -> None:
    service.desactivar(producto_id)
