from dataclasses import asdict, dataclass
from typing import Any

from errors.business_error import BusinessError
from errors.persistence_error import Persistencia_Exception
from modules.ubicaciones_stock.application.stock_service import Stock_Service
from modules.ubicaciones_stock.application.ubicacion_service import Ubicacion_Service
from modules.ubicaciones_stock.domain.exceptions import (
    Datos_Invalidos_Exception,
    Entidad_Duplicada_Exception,
    Entidad_No_Encontrada_Exception,
    Stock_Insuficiente_Exception,
    Ubicacion_Con_Stock_Exception,
)
from modules.ubicaciones_stock.dto import (
    Crear_CD_DTO,
    Crear_Local_DTO,
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


class Ubicaciones_Stock_Controller:
    """Controlador API para los recursos de Ubicaciones y Stock."""

    def __init__(
        self,
        ubicacion_service: Ubicacion_Service | None = None,
        stock_service: Stock_Service | None = None,
    ) -> None:
        self._ubicacion_service = ubicacion_service or Ubicacion_Service()
        self._stock_service = stock_service or Stock_Service()

    # --- Ubicaciones ---

    def crear_cd(self, body: dict[str, Any]) -> HTTP_Response:
        try:
            dto = Crear_CD_DTO(
                nombre=str(body.get("nombre", "")),
                direccion=str(body.get("direccion", "")),
                telefono=body.get("telefono"),
            )
            resultado = self._ubicacion_service.crear_centro_distribucion(dto)
            return HTTP_Response(status_code=201, data=asdict(resultado))
        except Entidad_Duplicada_Exception as e:
            return HTTP_Response(status_code=409, error=str(e))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Persistencia_Exception as e:
            return HTTP_Response(status_code=500, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")
    def crear_local(self, body: dict[str, Any]) -> HTTP_Response:
        try:
            dto = Crear_Local_DTO(
                nombre=str(body.get("nombre", "")),
                direccion=str(body.get("direccion", "")),
                telefono=str(body.get("telefono", "")),
            )
            resultado = self._ubicacion_service.crear_local(dto)
            return HTTP_Response(status_code=201, data=asdict(resultado))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Persistencia_Exception as e:
            return HTTP_Response(status_code=500, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def listar_ubicaciones(self, solo_activas: bool = True) -> HTTP_Response:
        try:
            resultado = self._ubicacion_service.listar_ubicaciones(solo_activas=solo_activas)
            return HTTP_Response(status_code=200, data=[asdict(u) for u in resultado])
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def obtener_ubicacion(self, ubicacion_id: int) -> HTTP_Response:
        try:
            resultado = self._ubicacion_service.obtener_ubicacion_por_id(ubicacion_id)
            return HTTP_Response(status_code=200, data=asdict(resultado))
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def dar_de_baja_ubicacion(self, ubicacion_id: int) -> HTTP_Response:
        try:
            self._ubicacion_service.dar_de_baja_ubicacion(ubicacion_id)
            return HTTP_Response(status_code=204)
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Ubicacion_Con_Stock_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    # --- Inventario y Stock ---

    def ingresar_mercaderia_cd(self, body: dict[str, Any]) -> HTTP_Response:
        try:
            producto_id = int(body.get("producto_id", 0))
            cd_id = int(body.get("cd_id", 0))
            cantidad = int(body.get("cantidad", 0))

            self._stock_service.ingresar_mercaderia_cd(
                producto_id=producto_id,
                cd_id=cd_id,
                cantidad=cantidad,
            )
            return HTTP_Response(
                status_code=200,
                data={"mensaje": "Mercadería ingresada exitosamente al Centro de Distribución."},
            )
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Datos_Invalidos_Exception as e:
            return HTTP_Response(status_code=400, error=str(e))
        except Persistencia_Exception as e:
            return HTTP_Response(status_code=500, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def consultar_disponible(self, producto_id: int, ubicacion_id: int) -> HTTP_Response:
        try:
            disponible = self._stock_service.consultar_disponible(producto_id, ubicacion_id)
            return HTTP_Response(
                status_code=200,
                data={
                    "producto_id": producto_id,
                    "ubicacion_id": ubicacion_id,
                    "cantidad_disponible": disponible,
                },
            )
        except Entidad_No_Encontrada_Exception as e:
            return HTTP_Response(status_code=404, error=str(e))
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def consultar_stock_por_ubicacion(self, ubicacion_id: int) -> HTTP_Response:
        try:
            resultado = self._stock_service.consultar_stock_ubicacion(ubicacion_id)
            return HTTP_Response(status_code=200, data=[asdict(s) for s in resultado])
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def consultar_stock_por_producto(self, producto_id: int) -> HTTP_Response:
        try:
            resultado = self._stock_service.consultar_stock_producto(producto_id)
            return HTTP_Response(status_code=200, data=[asdict(s) for s in resultado])
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")

    def listar_alertas(
        self,
        solo_no_leidas: bool = False,
        ubicacion_id: int | None = None,
    ) -> HTTP_Response:
        try:
            alertas = self._stock_service.listar_alertas(
                solo_no_leidas=solo_no_leidas,
                ubicacion_id=ubicacion_id,
            )
            return HTTP_Response(status_code=200, data=[asdict(a) for a in alertas])
        except Exception as e:
            return HTTP_Response(status_code=500, error="Error interno.")
