from domain.model.catalogo.producto import Producto
from domain.model.ubicaciones.ubicacion import Ubicacion
from domain.patterns.stock_observer.i_observable import IObservable
from domain.patterns.stock_observer.i_observador import IObservador


class Stock(IObservable):
    def __init__(self, producto: Producto, ubicacion: Ubicacion, cantidad_disponible: int = 0, cantidad_en_transito: int = 0, nivel_minimo: int = 0):
        self._producto = producto
        self._ubicacion = ubicacion
        self._cantidad_disponible = cantidad_disponible
        self._cantidad_en_transito = cantidad_en_transito
        self._nivel_minimo = nivel_minimo
        self._observadores: list[IObservador] = []

    @property
    def producto(self) -> Producto:
        return self._producto

    @producto.setter
    def producto(self, value: Producto) -> None:
        self._producto = value

    @property
    def ubicacion(self) -> Ubicacion:
        return self._ubicacion

    @ubicacion.setter
    def ubicacion(self, value: Ubicacion) -> None:
        self._ubicacion = value

    @property
    def cantidad_disponible(self) -> int:
        return self._cantidad_disponible

    @cantidad_disponible.setter
    def cantidad_disponible(self, value: int) -> None:
        self._cantidad_disponible = value

    @property
    def cantidad_en_transito(self) -> int:
        return self._cantidad_en_transito

    @cantidad_en_transito.setter
    def cantidad_en_transito(self, value: int) -> None:
        self._cantidad_en_transito = value

    @property
    def nivel_minimo(self) -> int:
        return self._nivel_minimo

    @nivel_minimo.setter
    def nivel_minimo(self, value: int) -> None:
        self._nivel_minimo = value

    @property
    def observadores(self) -> list[IObservador]:
        return self._observadores

    def suscribir(self, o: IObservador) -> None:
        raise NotImplementedError

    def desuscribir(self, o: IObservador) -> None:
        raise NotImplementedError

    def notificar(self) -> None:
        raise NotImplementedError

    def descontar_stock(self, cantidad: int) -> None:
        raise NotImplementedError

    def incrementar_disponible(self, cantidad: int) -> None:
        raise NotImplementedError
