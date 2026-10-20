from modules.catalogo.application import Catalogo_Consulta_Service, Inicializador_Stock_Contract
from modules.ubicaciones_stock.application.alerta_stock_observer import Alerta_Stock_Observer
from modules.ubicaciones_stock.application.registro_observadores_stock import Registro_Observadores_Stock
from modules.ubicaciones_stock.domain import NIVEL_MINIMO_INICIAL, Stock, Stock_Observer
from modules.ubicaciones_stock.domain.exceptions import (
    Entidad_No_Encontrada_Exception,
    Ingreso_No_Permitido_Exception,
    Stock_Insuficiente_Exception,
)
from modules.ubicaciones_stock.infrastructure.stock_repository import Stock_Repository
from modules.ubicaciones_stock.infrastructure.ubicacion_repository import Ubicacion_Repository


class Stock_Service(Inicializador_Stock_Contract):
    """Único dueño de las cantidades de stock (Integrante 1).

    Logística y ventas no tocan la tabla stocks: usan estos métodos. Cada descuento
    de disponible avisa a los observadores (alertas y reposición) si el stock queda
    en o bajo su mínimo.
    """

    def __init__(
        self,
        stock_repository: Stock_Repository | None = None,
        ubicacion_repository: Ubicacion_Repository | None = None,
        catalogo: Catalogo_Consulta_Service | None = None,
        observadores: list[Stock_Observer] | None = None,
    ) -> None:
        self._repository = stock_repository if stock_repository is not None else Stock_Repository()
        self._ubicaciones = ubicacion_repository if ubicacion_repository is not None else Ubicacion_Repository()
        self._catalogo = catalogo if catalogo is not None else Catalogo_Consulta_Service()
        self._observadores = (
            observadores
            if observadores is not None
            else [Alerta_Stock_Observer(), *Registro_Observadores_Stock.crear_observadores()]
        )

    # --- Catálogo e ingresos ---

    def inicializar_stock_para_producto(self, producto_id: int, nivel_minimo_existencia: int) -> None:
        """Al dar de alta un producto se crea su stock en cero en cada ubicación activa."""
        for ubicacion in self._ubicaciones.listar(solo_activas=True):
            if self._repository.obtener(producto_id, ubicacion.id) is None:
                self._repository.guardar(
                    Stock(producto_id, ubicacion.id, nivel_minimo_existencia, es_local=ubicacion.es_local)
                )

    def ingresar_mercaderia_cd(self, producto_id: int, cd_id: int, cantidad: int) -> Stock:
        """Ingreso de proveedor: suma disponible solo en el CD, nunca directo a un local."""
        ubicacion = self._ubicaciones.obtener_por_id(cd_id)
        if ubicacion is None or not ubicacion.activo:
            raise Entidad_No_Encontrada_Exception(f"No existe una ubicación activa con id {cd_id}.")
        if not ubicacion.es_centro_distribucion:
            raise Ingreso_No_Permitido_Exception(
                "La mercadería de proveedores solo ingresa al Centro de Distribución; "
                "los locales se abastecen por el flujo logístico."
            )
        self._catalogo.obtener_producto_activo(producto_id)
        stock = self._obtener_o_crear(producto_id, cd_id, es_local=False)
        stock.incrementar_disponible(cantidad)
        self._repository.actualizar(stock)
        return stock

    def actualizar_nivel_minimo(self, producto_id: int, ubicacion_id: int, nivel_minimo_existencia: int) -> Stock:
        stock = self.consultar_stock(producto_id, ubicacion_id)
        self._suscribir_observadores(stock)
        stock.actualizar_nivel_minimo(nivel_minimo_existencia)
        self._repository.actualizar(stock)
        return stock

    def consultar_stock(self, producto_id: int, ubicacion_id: int) -> Stock:
        stock = self._repository.obtener(producto_id, ubicacion_id)
        if stock is None:
            raise Entidad_No_Encontrada_Exception(
                f"No existe stock del producto {producto_id} en la ubicación {ubicacion_id}."
            )
        return stock

    def listar(
        self,
        ubicacion_id: int | None = None,
        producto_id: int | None = None,
        solo_bajo_minimo: bool = False,
    ) -> list[Stock]:
        return self._repository.listar(ubicacion_id, producto_id, solo_bajo_minimo)

    # --- Contrato con ventas_caja (Integrante 3) ---

    def consultar_disponible(self, producto_id: int, ubicacion_id: int) -> int:
        """Disponible y verificado; si el producto nunca tuvo stock en la ubicación, es 0."""
        stock = self._repository.obtener(producto_id, ubicacion_id)
        return stock.cantidad_disponible if stock is not None else 0

    def descontar_por_venta(self, producto_id: int, local_id: int, cantidad: int) -> None:
        self._descontar(producto_id, local_id, cantidad)

    def reingresar_por_devolucion(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stock = self._repository.obtener_para_actualizar(producto_id, local_id)
        if stock is None:
            raise Entidad_No_Encontrada_Exception(
                f"No existe stock del producto {producto_id} en el local {local_id}."
            )
        stock.incrementar_disponible(cantidad)
        self._repository.actualizar(stock)

    # --- Contrato con logística (Integrante 2) ---

    def reservar_para_despacho(self, producto_id: int, cd_id: int, cantidad: int) -> None:
        self._descontar(producto_id, cd_id, cantidad)

    def registrar_en_transito(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stock = self._obtener_o_crear(producto_id, local_id, es_local=True)
        stock.registrar_en_transito(cantidad)
        self._repository.actualizar(stock)

    def acreditar_verificado(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stock = self._obtener_para_movimiento(producto_id, local_id)
        stock.acreditar_desde_transito(cantidad)
        self._repository.actualizar(stock)

    def registrar_merma(self, producto_id: int, local_id: int, cantidad: int) -> None:
        stock = self._obtener_para_movimiento(producto_id, local_id)
        stock.registrar_merma_transito(cantidad)
        self._repository.actualizar(stock)

    # --- Internos ---

    def _descontar(self, producto_id: int, ubicacion_id: int, cantidad: int) -> None:
        stock = self._obtener_para_movimiento(producto_id, ubicacion_id)
        self._suscribir_observadores(stock)
        stock.descontar_disponible(cantidad)
        self._repository.actualizar(stock)

    def _suscribir_observadores(self, stock: Stock) -> None:
        for observador in self._observadores:
            stock.agregar_observador(observador)

    def _obtener_para_movimiento(self, producto_id: int, ubicacion_id: int) -> Stock:
        """Sin registro de stock no hay unidades que mover: se informa como stock insuficiente."""
        stock = self._repository.obtener_para_actualizar(producto_id, ubicacion_id)
        if stock is None:
            raise Stock_Insuficiente_Exception(
                f"No hay stock del producto {producto_id} en la ubicación {ubicacion_id}."
            )
        return stock

    def _obtener_o_crear(self, producto_id: int, ubicacion_id: int, es_local: bool) -> Stock:
        stock = self._repository.obtener_para_actualizar(producto_id, ubicacion_id)
        if stock is not None:
            return stock
        return self._repository.guardar(Stock(producto_id, ubicacion_id, NIVEL_MINIMO_INICIAL, es_local=es_local))
