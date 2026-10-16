from domain.patterns.pago_strategy.estrategia_pago import EstrategiaPago


class PagoTransferencia(EstrategiaPago):
    def __init__(self, cbu: str):
        self._cbu = cbu

    @property
    def cbu(self) -> str:
        return self._cbu

    @cbu.setter
    def cbu(self, value: str) -> None:
        self._cbu = value

    def procesar_pago(self, monto: float) -> bool:
        raise NotImplementedError
