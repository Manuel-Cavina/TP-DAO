from collections.abc import Iterable
from datetime import datetime, timedelta
from decimal import Decimal

from modules.ventas_caja.domain.detalle_devolucion import Detalle_Devolucion
from modules.ventas_caja.domain.exceptions import (
    Devolucion_Invalida_Exception,
    Venta_No_Encontrada_Exception,
)
from modules.ventas_caja.domain.venta import Venta

# Regla definida por el equipo: plazo máximo para devolver desde la fecha de la venta.
PLAZO_DEVOLUCION = timedelta(days=30)


class Devolucion:
    """Devolución parcial o total de una venta registrada del mismo local (V5)."""

    def __init__(
        self,
        venta: Venta,
        local_id: int,
        fecha_hora: datetime,
        motivo: str,
        devoluciones_previas: Iterable["Devolucion"] = (),
        id: int | None = None,
    ) -> None:
        if venta.id is None or venta.comprobante is None:
            raise Venta_No_Encontrada_Exception("La devolución debe referenciar una venta registrada.")
        if venta.local_id != local_id:
            raise Venta_No_Encontrada_Exception(
                f"La venta {venta.id} no pertenece al local {local_id}."
            )
        if not isinstance(fecha_hora, datetime):
            raise Devolucion_Invalida_Exception("La fecha y hora de la devolución debe ser datetime.")
        if fecha_hora < venta.fecha_hora:
            raise Devolucion_Invalida_Exception("La devolución no puede ser anterior a la venta.")
        if fecha_hora - venta.fecha_hora > PLAZO_DEVOLUCION:
            raise Devolucion_Invalida_Exception(
                f"Venció el plazo de {PLAZO_DEVOLUCION.days} días para devolver la venta {venta.id}."
            )
        if not isinstance(motivo, str) or not motivo.strip():
            raise Devolucion_Invalida_Exception("La devolución debe indicar un motivo.")

        self._id = id
        self._venta = venta
        self._fecha_hora = fecha_hora
        self._motivo = motivo.strip()
        self._medio_pago = venta.comprobante.medio_pago
        self._detalles: list[Detalle_Devolucion] = []
        self._ya_devuelto = _acumular_por_producto(devoluciones_previas)

    @classmethod
    def reconstruir(
        cls,
        id: int,
        venta: Venta,
        fecha_hora: datetime,
        motivo: str,
        detalles: Iterable[Detalle_Devolucion],
    ) -> "Devolucion":
        """Rearma una devolución persistida con sus líneas ya validadas al registrarla."""
        devolucion = cls(venta, venta.local_id, fecha_hora, motivo, id=id)
        devolucion._detalles = list(detalles)
        return devolucion

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Devolucion_Invalida_Exception("No se puede modificar el id de una devolución ya asignado.")
        self._id = valor

    @property
    def venta(self) -> Venta:
        return self._venta

    @property
    def local_id(self) -> int:
        return self._venta.local_id

    @property
    def fecha_hora(self) -> datetime:
        return self._fecha_hora

    @property
    def motivo(self) -> str:
        return self._motivo

    @property
    def medio_pago(self) -> str:
        """El reintegro se hace por el mismo medio con que se cobró la venta."""
        return self._medio_pago

    @property
    def detalles(self) -> tuple[Detalle_Devolucion, ...]:
        return tuple(self._detalles)

    @property
    def id_registrado(self) -> int:
        """Id de una devolución ya persistida; falla si todavía no se guardó."""
        if self._id is None:
            raise Devolucion_Invalida_Exception("La devolución todavía no fue registrada.")
        return self._id

    @property
    def monto_reintegrado(self) -> Decimal:
        """Cantidad × precio unitario histórico. No incluye el recargo de cuotas (consigna, V5)."""
        return sum((detalle.monto for detalle in self._detalles), Decimal("0"))

    def agregar_producto(self, producto_id: int, cantidad: int) -> None:
        """Devuelve unidades de una línea de la venta sin superar lo comprado (acumulado)."""
        linea = self._venta.buscar_detalle(producto_id)
        if linea is None:
            raise Devolucion_Invalida_Exception(
                f"El producto {producto_id} no forma parte de la venta {self._venta.id}."
            )
        nuevo = Detalle_Devolucion(producto_id, cantidad, linea.precio_unitario)

        existente = self._buscar_detalle(producto_id)
        en_esta = existente.cantidad if existente is not None else 0
        acumulado = self._ya_devuelto.get(producto_id, 0) + en_esta + cantidad
        if acumulado > linea.cantidad:
            disponible = linea.cantidad - self._ya_devuelto.get(producto_id, 0) - en_esta
            raise Devolucion_Invalida_Exception(
                f"Del producto {producto_id} se compraron {linea.cantidad} unidades y solo "
                f"quedan {disponible} por devolver."
            )

        if existente is None:
            self._detalles.append(nuevo)
            return
        unificado = Detalle_Devolucion(producto_id, en_esta + cantidad, linea.precio_unitario)
        self._detalles[self._detalles.index(existente)] = unificado

    def validar_tiene_detalles(self) -> None:
        if not self._detalles:
            raise Devolucion_Invalida_Exception("La devolución debe tener al menos un producto.")

    def _buscar_detalle(self, producto_id: int) -> Detalle_Devolucion | None:
        for detalle in self._detalles:
            if detalle.producto_id == producto_id:
                return detalle
        return None


def _acumular_por_producto(devoluciones: Iterable[Devolucion]) -> dict[int, int]:
    acumulado: dict[int, int] = {}
    for devolucion in devoluciones:
        for detalle in devolucion.detalles:
            acumulado[detalle.producto_id] = acumulado.get(detalle.producto_id, 0) + detalle.cantidad
    return acumulado
