from modules.ubicaciones_stock.domain.exceptions import Cantidad_Invalida_Exception, Stock_Insuficiente_Exception
from modules.ubicaciones_stock.domain.stock_observer import Stock_Observer

# Mínimo con el que nace un stock creado sin indicación (ubicación nueva o primer tránsito).
NIVEL_MINIMO_INICIAL = 1


class Stock:
    """Existencias de un producto en una ubicación (sujeto del patrón Observer).

    Las cantidades nunca quedan negativas. Cada vez que el disponible baja y queda en
    el nivel mínimo o por debajo, notifica a sus observadores.
    """

    def __init__(
        self,
        producto_id: int,
        ubicacion_id: int,
        nivel_minimo_existencia: int,
        cantidad_disponible: int = 0,
        cantidad_en_transito: int = 0,
        es_local: bool = False,
        id: int | None = None,
    ) -> None:
        if cantidad_disponible < 0 or cantidad_en_transito < 0:
            raise Cantidad_Invalida_Exception("Las cantidades de stock no pueden ser negativas.")
        self._id = id
        self._producto_id = producto_id
        self._ubicacion_id = ubicacion_id
        self._nivel_minimo = _positiva(nivel_minimo_existencia, "El nivel mínimo de existencia")
        self._disponible = cantidad_disponible
        self._en_transito = cantidad_en_transito
        self._es_local = es_local
        self._observadores: list[Stock_Observer] = []

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Cantidad_Invalida_Exception("No se puede modificar el id de un stock ya asignado.")
        self._id = valor

    @property
    def producto_id(self) -> int:
        return self._producto_id

    @property
    def ubicacion_id(self) -> int:
        return self._ubicacion_id

    @property
    def nivel_minimo_existencia(self) -> int:
        return self._nivel_minimo

    @property
    def cantidad_disponible(self) -> int:
        return self._disponible

    @property
    def cantidad_en_transito(self) -> int:
        return self._en_transito

    @property
    def es_local(self) -> bool:
        return self._es_local

    @property
    def esta_en_o_bajo_minimo(self) -> bool:
        return self._disponible <= self._nivel_minimo

    @property
    def reposicion_sugerida(self) -> int:
        """Cantidad para volver a un colchón de dos veces el mínimo."""
        return max(self._nivel_minimo * 2 - self._disponible, 0)

    # --- Observer ---

    def agregar_observador(self, observador: Stock_Observer) -> None:
        self._observadores.append(observador)

    def notificar(self) -> None:
        for observador in self._observadores:
            observador.notificar_stock_bajo(self)

    # --- Movimientos ---

    def incrementar_disponible(self, cantidad: int) -> None:
        """Ingreso de proveedor al CD o reingreso por devolución."""
        self._disponible += _positiva(cantidad, "La cantidad")

    def descontar_disponible(self, cantidad: int) -> None:
        """Venta en un local o reserva para despacho en el CD."""
        cantidad = _positiva(cantidad, "La cantidad")
        if cantidad > self._disponible:
            raise Stock_Insuficiente_Exception(
                f"Stock insuficiente del producto {self._producto_id} en la ubicación {self._ubicacion_id}: "
                f"disponible {self._disponible}, pedido {cantidad}."
            )
        self._disponible -= cantidad
        if self.esta_en_o_bajo_minimo:
            self.notificar()

    def registrar_en_transito(self, cantidad: int) -> None:
        """Mercadería despachada hacia este local: todavía no es vendible (V1)."""
        self._en_transito += _positiva(cantidad, "La cantidad")

    def acreditar_desde_transito(self, cantidad: int) -> None:
        """Bulto verificado: pasa de tránsito a disponible."""
        self._descontar_transito(cantidad)
        self._disponible += cantidad

    def registrar_merma_transito(self, cantidad: int) -> None:
        """Bulto rechazado: sale de tránsito sin habilitar venta."""
        self._descontar_transito(cantidad)

    def actualizar_nivel_minimo(self, nivel_minimo_existencia: int) -> None:
        """Si el nuevo mínimo deja al disponible en o bajo el umbral, también se avisa."""
        anterior = self._nivel_minimo
        self._nivel_minimo = _positiva(nivel_minimo_existencia, "El nivel mínimo de existencia")
        if self._nivel_minimo > anterior and self.esta_en_o_bajo_minimo:
            self.notificar()

    def _descontar_transito(self, cantidad: int) -> None:
        cantidad = _positiva(cantidad, "La cantidad")
        if cantidad > self._en_transito:
            raise Stock_Insuficiente_Exception(
                f"La ubicación {self._ubicacion_id} no tiene en tránsito {cantidad} unidades "
                f"del producto {self._producto_id} (hay {self._en_transito})."
            )
        self._en_transito -= cantidad


def _positiva(valor: int, campo: str) -> int:
    if not isinstance(valor, int) or isinstance(valor, bool) or valor <= 0:
        raise Cantidad_Invalida_Exception(f"{campo} debe ser un entero mayor a cero.")
    return valor
