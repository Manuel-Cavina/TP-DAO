from domain.patterns.pago_strategy.estrategia_pago import EstrategiaPago


class PagoTarjeta(EstrategiaPago):
    def __init__(self, numero_tarjeta: str, cuotas: int = 1):
        self._numero_tarjeta = numero_tarjeta
        self._cuotas = cuotas

    @property
    def numero_tarjeta(self) -> str:
        return self._numero_tarjeta

    @numero_tarjeta.setter
    def numero_tarjeta(self, value: str) -> None:
        self._numero_tarjeta = value

    @property
    def cuotas(self) -> int:
        return self._cuotas

    @cuotas.setter
    def cuotas(self, value: int) -> None:
        self._cuotas = value

    def procesar_pago(self, monto: float) -> bool:
        raise NotImplementedError
