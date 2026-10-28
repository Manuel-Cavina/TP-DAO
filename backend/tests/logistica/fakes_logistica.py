"""Implementación en memoria de Stock_Service_Contract para pruebas de servicios."""

from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Ubicacion_No_Encontrada_Exception,
    Stock_Insuficiente_Exception,
)


class Fake_Stock_Logistica(Stock_Service_Contract):
    """Registra cada operación recibida; valida ubicaciones, productos y el stock del CD."""

    def __init__(
        self,
        centros: set[int],
        locales: set[int],
        productos: set[int],
        stock_cd: dict[tuple[int, int], int] | None = None,
    ) -> None:
        self._centros = centros
        self._locales = locales
        self._productos = productos
        self._stock_cd = dict(stock_cd or {})
        self.operaciones: list[tuple[str, int, int, int]] = []

    def validar_centro_distribucion(self, ubicacion_id: int) -> None:
        if ubicacion_id not in self._centros:
            raise Ubicacion_No_Encontrada_Exception(f"No existe el CD {ubicacion_id}.")

    def validar_local(self, ubicacion_id: int) -> None:
        if ubicacion_id not in self._locales:
            raise Ubicacion_No_Encontrada_Exception(f"No existe el local {ubicacion_id}.")

    def validar_producto(self, producto_id: int) -> None:
        if producto_id not in self._productos:
            raise Producto_No_Encontrado_Exception(f"No existe el producto {producto_id}.")

    def validar_stock_disponible(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        disponible = self._stock_cd.get((producto_id, cd_id), 0)
        if cantidad > disponible:
            raise Stock_Insuficiente_Exception(f"Stock insuficiente del producto {producto_id} en CD {cd_id}.")

    def reservar_para_despacho(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        disponible = self._stock_cd.get((producto_id, cd_id), 0)
        if cantidad > disponible:
            raise Stock_Insuficiente_Exception(f"Stock insuficiente del producto {producto_id}.")
        self._stock_cd[(producto_id, cd_id)] = disponible - cantidad
        self.operaciones.append(("RESERVAR", producto_id, cd_id, cantidad))

    def registrar_en_transito(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self.operaciones.append(("EN_TRANSITO", producto_id, local_id, cantidad))

    def acreditar_verificado(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self.operaciones.append(("ACREDITAR", producto_id, local_id, cantidad))

    def registrar_merma(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self.operaciones.append(("MERMA", producto_id, local_id, cantidad))
