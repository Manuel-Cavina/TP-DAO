from dataclasses import asdict, dataclass
from typing import Any

from errors.business_error import BusinessError
from errors.persistence_error import Persistencia_Exception
from modules.catalogo.application.categoria_service import Categoria_Service
from modules.catalogo.application.producto_service import Producto_Service
from modules.catalogo.application.proveedor_service import Proveedor_Service
from modules.catalogo.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_Duplicada_Exception,
    Entidad_No_Encontrada_Exception,
)
from modules.catalogo.dto import (
    Actualizar_Proveedor_DTO,
    Crear_Categoria_DTO,
    Crear_Producto_DTO,
    Crear_Proveedor_DTO,
)


@dataclass(frozen=True)
class HTTP_Response:
    """Respuesta HTTP estandarizada para la capa API."""

    status_code: int
    data: Any = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status_code": self.status_code,
            "data": self.data,
            "error": self.error,
        }


class Catalogo_Controller:
    """Controlador API para el módulo de Catálogo."""

    def __init__(
        self,
        categoria_service: Categoria_Service | None = None,
        proveedor_service: Proveedor_Service | None = None,
        producto_service: Producto_Service | None = None,
    ) -> None:
        self._categoria_service = categoria_service or Categoria_Service()
        self._proveedor_service = proveedor_service or Proveedor_Service()
        self._producto_service = producto_service or Producto_Service()

    # --- Categorías ---

    def crear_categoria(self, body: dict[str, Any]) -> HTTP_Response:
        try:
            nombre = body.get("nombre", "")
            dto = Crear_Categoria_DTO(nombre=nombre)
            resultado = self._categoria_service.crear_categoria(dto)
            return HTTP_Response(status_code=201, data=asdict(resultado))
        except Entidad_Duplicada_Exception as e:
            return HTTP_Response(status_code=409, error=str(e))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Persistencia_Exception as e:
            return HTTP_Response(status_code=500, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def listar_categorias(self) -> HTTP_Response:
        try:
            resultado = self._categoria_service.listar_categorias()
            return HTTP_Response(status_code=200, data=[asdict(c) for c in resultado])
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def obtener_categoria(self, categoria_id: int) -> HTTP_Response:
        try:
            resultado = self._categoria_service.obtener_categoria_por_id(categoria_id)
            return HTTP_Response(status_code=200, data=asdict(resultado))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    # --- Proveedores ---

    def crear_proveedor(self, body: dict[str, Any]) -> HTTP_Response:
        try:
            dto = Crear_Proveedor_DTO(
                cuit=str(body.get("cuit", "")),
                razon_social=str(body.get("razon_social", "")),
                telefono=str(body.get("telefono", "")),
                email=str(body.get("email", "")),
            )
            resultado = self._proveedor_service.crear_proveedor(dto)
            return HTTP_Response(status_code=201, data=asdict(resultado))
        except Entidad_Duplicada_Exception as e:
            return HTTP_Response(status_code=409, error=str(e))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Persistencia_Exception as e:
            return HTTP_Response(status_code=500, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def actualizar_proveedor(self, cuit: str, body: dict[str, Any]) -> HTTP_Response:
        try:
            dto = Actualizar_Proveedor_DTO(
                razon_social=str(body.get("razon_social", "")),
                telefono=str(body.get("telefono", "")),
                email=str(body.get("email", "")),
            )
            resultado = self._proveedor_service.actualizar_proveedor(cuit, dto)
            return HTTP_Response(status_code=200, data=asdict(resultado))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def dar_de_baja_proveedor(self, cuit: str) -> HTTP_Response:
        try:
            self._proveedor_service.dar_de_baja_proveedor(cuit)
            return HTTP_Response(status_code=204)
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def listar_proveedores(self, solo_activos: bool = True) -> HTTP_Response:
        try:
            resultado = self._proveedor_service.listar_proveedores(solo_activos=solo_activos)
            return HTTP_Response(status_code=200, data=[asdict(p) for p in resultado])
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def obtener_proveedor(self, cuit: str) -> HTTP_Response:
        try:
            resultado = self._proveedor_service.obtener_proveedor_por_cuit(cuit)
            return HTTP_Response(status_code=200, data=asdict(resultado))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    # --- Productos ---

    def crear_producto(self, body: dict[str, Any]) -> HTTP_Response:
        try:
            dto = Crear_Producto_DTO(
                codigo=str(body.get("codigo", "")),
                nombre=str(body.get("nombre", "")),
                precio_venta=float(body.get("precio_venta", 0)),
                costo_unitario=float(body.get("costo_unitario", 0)),
                categoria_id=int(body.get("categoria_id", 0)),
                proveedor_id=int(body.get("proveedor_id", 0)),
                nivel_minimo=int(body.get("nivel_minimo", 1)),
            )
            resultado = self._producto_service.crear_producto(dto)
            return HTTP_Response(status_code=201, data=asdict(resultado))
        except Entidad_Duplicada_Exception as e:
            return HTTP_Response(status_code=409, error=str(e))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except BusinessError as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Persistencia_Exception as e:
            return HTTP_Response(status_code=500, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def actualizar_precio_producto(self, codigo: str, body: dict[str, Any]) -> HTTP_Response:
        try:
            nuevo_precio = float(body.get("precio_venta", 0))
            resultado = self._producto_service.actualizar_precio(codigo, nuevo_precio)
            return HTTP_Response(status_code=200, data=asdict(resultado))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def actualizacion_masiva(self, body: dict[str, Any]) -> HTTP_Response:
        try:
            items_raw = body.get("actualizaciones") or body.get("items") or []
            if isinstance(body, list):
                items_raw = body
            from modules.catalogo.dto import Item_Actualizacion_Masiva_DTO
            items = [
                Item_Actualizacion_Masiva_DTO(**it) if isinstance(it, dict) else it
                for it in items_raw
            ]
            resultado = self._producto_service.actualizar_masivo(items)
            from modules.catalogo.mappers import Catalogo_Mapper
            return HTTP_Response(
                status_code=200,
                data={
                    "actualizados": len(resultado),
                    "productos": [Catalogo_Mapper.producto_a_dto(p).model_dump() for p in resultado],
                },
            )
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error=str(e))

    def dar_de_baja_producto(self, codigo: str) -> HTTP_Response:
        try:
            self._producto_service.dar_de_baja_producto(codigo)
            return HTTP_Response(status_code=204)
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def listar_productos(
        self,
        solo_activos: bool = True,
        categoria_id: int | None = None,
    ) -> HTTP_Response:
        try:
            resultado = self._producto_service.listar_productos(
                solo_activos=solo_activos, categoria_id=categoria_id
            )
            return HTTP_Response(status_code=200, data=[asdict(p) for p in resultado])
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def obtener_producto(self, codigo: str) -> HTTP_Response:
        try:
            resultado = self._producto_service.obtener_producto_por_codigo(codigo)
            return HTTP_Response(status_code=200, data=asdict(resultado))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")
