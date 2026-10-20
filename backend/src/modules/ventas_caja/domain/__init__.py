"""Entidades y reglas de ventas y caja."""

from modules.ventas_caja.domain.comprobante import Comprobante
from modules.ventas_caja.domain.detalle_devolucion import Detalle_Devolucion
from modules.ventas_caja.domain.detalle_venta import Detalle_Venta
from modules.ventas_caja.domain.devolucion import PLAZO_DEVOLUCION, Devolucion
from modules.ventas_caja.domain.estrategia_pago import Estrategia_Pago, Resultado_Pago
from modules.ventas_caja.domain.pago_efectivo import Pago_Efectivo
from modules.ventas_caja.domain.pago_tarjeta import RECARGO_POR_CUOTAS, Pago_Tarjeta
from modules.ventas_caja.domain.pago_transferencia import Pago_Transferencia
from modules.ventas_caja.domain.saldo_caja import Saldo_Caja
from modules.ventas_caja.domain.venta import Venta

__all__ = [
    "Comprobante",
    "Detalle_Devolucion",
    "Detalle_Venta",
    "Devolucion",
    "Estrategia_Pago",
    "PLAZO_DEVOLUCION",
    "Pago_Efectivo",
    "Pago_Tarjeta",
    "Pago_Transferencia",
    "RECARGO_POR_CUOTAS",
    "Resultado_Pago",
    "Saldo_Caja",
    "Venta",
]
