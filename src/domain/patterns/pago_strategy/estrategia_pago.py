from abc import ABC, abstractmethod


class EstrategiaPago(ABC):
    @abstractmethod
    def procesar_pago(self, monto: float) -> bool:
        ...
