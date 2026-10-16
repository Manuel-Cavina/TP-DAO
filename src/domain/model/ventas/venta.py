from datetime import date

from domain.model.ubicaciones.local import Local
from domain.model.ventas.detalle_venta import DetalleVenta
from domain.patterns.pago_strategy.estrategia_pago import EstrategiaPago


class Venta:
    def __init__(self, id: str, fecha: date, local: Local, metodo_de_pago: EstrategiaPago, detalles: list[DetalleVenta] | None = None, total: float = 0.0):
        self._id = id
        self._fecha = fecha
        self._local = local
        self._metodo_de_pago = metodo_de_pago
        self._detalles = detalles if detalles is not None else []
        self._total = total

    @property
    def id(self) -> str:
        return self._id

    @id.setter
    def id(self, value: str) -> None:
        self._id = value

    @property
    def fecha(self) -> date:
        return self._fecha

    @fecha.setter
    def fecha(self, value: date) -> None:
        self._fecha = value

    @property
    def local(self) -> Local:
        return self._local

    @local.setter
    def local(self, value: Local) -> None:
        self._local = value

    @property
    def metodo_de_pago(self) -> EstrategiaPago:
        return self._metodo_de_pago

    @metodo_de_pago.setter
    def metodo_de_pago(self, value: EstrategiaPago) -> None:
        self._metodo_de_pago = value

    @property
    def detalles(self) -> list[DetalleVenta]:
        return self._detalles

    @detalles.setter
    def detalles(self, value: list[DetalleVenta]) -> None:
        self._detalles = value

    @property
    def total(self) -> float:
        return self._total

    @total.setter
    def total(self, value: float) -> None:
        self._total = value

    def registrar(self) -> None:
        raise NotImplementedError

    def realizar_cobro(self) -> None:
        raise NotImplementedError
