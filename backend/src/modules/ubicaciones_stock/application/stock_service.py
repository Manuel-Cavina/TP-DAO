from modules.ubicaciones_stock.domain.alerta_stock import Alerta_Stock
from modules.ubicaciones_stock.domain.exceptions import Datos_Invalidos_Exception, Entidad_No_Encontrada_Exception
from modules.ubicaciones_stock.domain.observers import Alerta_Stock_Observer, Reposicion_Local_Observer, Reposicion_Logistica_Service
from modules.ubicaciones_stock.domain.stock import Stock
from modules.ubicaciones_stock.dto import Alerta_Stock_DTO, Stock_DTO
from modules.ubicaciones_stock.infrastructure.stock_repository import Stock_Repository
from modules.ubicaciones_stock.infrastructure.ubicacion_repository import Ubicacion_Repository
from modules.ubicaciones_stock.mappers.stock_mapper import Alerta_Stock_Mapper, Stock_Mapper


class Stock_Service:
    """Casos de uso de inventario y contratos consumidos por Logística y Ventas."""

    def __init__(self, stock_repo: Stock_Repository | None = None, ubicacion_repo: Ubicacion_Repository | None = None,
                 reposicion_service: Reposicion_Logistica_Service | None = None) -> None:
        self._stock_repo = stock_repo or Stock_Repository()
        self._ubicacion_repo = ubicacion_repo or Ubicacion_Repository()
        self._reposicion_service = reposicion_service

    def suscribir_observadores_por_defecto(self, stock: Stock) -> None:
        if not any(isinstance(obs, Alerta_Stock_Observer) for obs in stock.observadores):
            stock.agregar_observador(Alerta_Stock_Observer(self._stock_repo))
        if self._reposicion_service and not any(isinstance(obs, Reposicion_Local_Observer) for obs in stock.observadores):
            stock.agregar_observador(Reposicion_Local_Observer(self._reposicion_service, self._ubicacion_repo))

    def configurar_observadores_para_stock(self, stock: Stock) -> None:
        self.suscribir_observadores_por_defecto(stock)

    def inicializar_stock_para_producto(self, producto_id: int, nivel_minimo: int) -> None:
        if producto_id <= 0 or nivel_minimo <= 0:
            raise Datos_Invalidos_Exception("El producto y el nivel mínimo deben ser válidos.")
        self._stock_repo.inicializar_stock_para_producto(producto_id, nivel_minimo)

    def ingresar_mercaderia_cd(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        if cantidad <= 0:
            raise Datos_Invalidos_Exception("La cantidad a ingresar debe ser mayor a cero.")
        ubicacion = self._ubicacion_repo.buscar_por_id(cd_id)
        if not ubicacion:
            raise Entidad_No_Encontrada_Exception(f"No existe la ubicación con ID {cd_id}.")
        if not ubicacion.es_centro_distribucion():
            raise Datos_Invalidos_Exception("Las compras de proveedores solo pueden ingresar al Centro de Distribución.")
        stock = self._stock_repo.buscar_por_producto_y_ubicacion(producto_id, cd_id)
        if not stock:
            stock = self._stock_repo.crear(Stock(producto_id, cd_id))
        stock.incrementar_disponible(cantidad)
        self._stock_repo.actualizar(stock)

    def _stock(self, producto_id: int, ubicacion_id: int) -> Stock:
        stock = self._stock_repo.buscar_por_producto_y_ubicacion(producto_id, ubicacion_id)
        if not stock:
            raise Entidad_No_Encontrada_Exception(f"No existe stock para el producto {producto_id} en la ubicación {ubicacion_id}.")
        return stock

    @staticmethod
    def _cantidad_valida(cantidad: int) -> None:
        if cantidad <= 0:
            raise Datos_Invalidos_Exception("La cantidad debe ser mayor a cero.")

    def reservar_para_despacho(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        self._cantidad_valida(cantidad)
        stock = self._stock(producto_id, cd_id)
        self.suscribir_observadores_por_defecto(stock)
        stock.descontar_disponible(cantidad)
        self._stock_repo.actualizar(stock)

    def registrar_en_transito(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._cantidad_valida(cantidad)
        stock = self._stock(producto_id, local_id)
        stock.mover_a_transito(cantidad)
        self._stock_repo.actualizar(stock)

    def acreditar_verificado(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._cantidad_valida(cantidad)
        stock = self._stock(producto_id, local_id)
        stock.acreditar_desde_transito(cantidad)
        self._stock_repo.actualizar(stock)

    def registrar_merma(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._cantidad_valida(cantidad)
        stock = self._stock(producto_id, local_id)
        stock.registrar_merma_transito(cantidad)
        self._stock_repo.actualizar(stock)

    def consultar_disponible(self, producto_id: int, ubicacion_id: int) -> int:
        return self._stock(producto_id, ubicacion_id).cantidad_disponible

    def descontar_por_venta(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._cantidad_valida(cantidad)
        stock = self._stock(producto_id, local_id)
        self.suscribir_observadores_por_defecto(stock)
        stock.descontar_disponible(cantidad)
        self._stock_repo.actualizar(stock)

    def reingresar_por_devolucion(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._cantidad_valida(cantidad)
        stock = self._stock(producto_id, local_id)
        stock.reingresar_disponible(cantidad)
        self._stock_repo.actualizar(stock)

    def consultar_stock_ubicacion(self, ubicacion_id: int) -> list[Stock_DTO]:
        return [Stock_Mapper.to_dto(stock) for stock in self._stock_repo.listar_por_ubicacion(ubicacion_id)]

    def consultar_stock_producto(self, producto_id: int) -> list[Stock_DTO]:
        return [Stock_Mapper.to_dto(stock) for stock in self._stock_repo.listar_por_producto(producto_id)]

    def listar_alertas(self, solo_no_leidas: bool = False, ubicacion_id: int | None = None) -> list[Alerta_Stock_DTO]:
        return [Alerta_Stock_Mapper.to_dto(alerta) for alerta in self._stock_repo.listar_alertas(solo_no_leidas, ubicacion_id)]
