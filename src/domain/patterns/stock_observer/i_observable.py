from abc import ABC, abstractmethod

from domain.patterns.stock_observer.i_observador import IObservador


class IObservable(ABC):
    @abstractmethod
    def suscribir(self, o: IObservador) -> None:
        ...

    @abstractmethod
    def desuscribir(self, o: IObservador) -> None:
        ...

    @abstractmethod
    def notificar(self) -> None:
        ...
