from datetime import datetime

from modules.ventas_caja.application.stock_venta_contract import Stock_Venta_Contract
from modules.ventas_caja.domain import Devolucion
from modules.ventas_caja.domain.exceptions import Venta_No_Encontrada_Exception
from modules.ventas_caja.infrastructure.devolucion_repository import Devolucion_Repository
from modules.ventas_caja.infrastructure.venta_repository import Venta_Repository


class Devolucion_Service:
    """Caso de uso de devolución (V5): valida contra la venta, reingresa stock y resta de la caja."""

    def __init__(
        self,
        stock: Stock_Venta_Contract,
        venta_repository: Venta_Repository | None = None,
        devolucion_repository: Devolucion_Repository | None = None,
    ) -> None:
        self._stock = stock
        self._venta_repository = venta_repository if venta_repository is not None else Venta_Repository()
        self._devolucion_repository = (
            devolucion_repository if devolucion_repository is not None else Devolucion_Repository()
        )

    def registrar_devolucion(
        self,
        venta_id: int,
        local_id: int,
        items: list[tuple[int, int]],
        motivo: str,
        fecha_hora: datetime | None = None,
    ) -> Devolucion:
        """Registra la devolución de (producto_id, cantidad) por ítem de una venta del local."""
        venta = self._venta_repository.obtener_para_devolucion(venta_id)
        if venta is None:
            raise Venta_No_Encontrada_Exception(f"No existe la venta {venta_id}.")

        previas = self._devolucion_repository.listar_por_venta(venta)
        devolucion = Devolucion(
            venta=venta,
            local_id=local_id,
            fecha_hora=fecha_hora or datetime.now(),
            motivo=motivo,
            devoluciones_previas=previas,
        )
        for producto_id, cantidad in items:
            devolucion.agregar_producto(producto_id, cantidad)
        devolucion.validar_tiene_detalles()

        for detalle in devolucion.detalles:
            self._stock.reingresar_por_devolucion(detalle.producto_id, local_id, detalle.cantidad)
        return self._devolucion_repository.guardar(devolucion)

    def listar_por_venta(self, venta_id: int) -> list[Devolucion]:
        venta = self._venta_repository.obtener_por_id(venta_id)
        if venta is None:
            raise Venta_No_Encontrada_Exception(f"No existe la venta {venta_id}.")
        return self._devolucion_repository.listar_por_venta(venta)
