from domain.patterns.pago_strategy.estrategia_pago import EstrategiaPago


class PagoEfectivo(EstrategiaPago):
    def procesar_pago(self, monto: float) -> bool:
        raise NotImplementedError
