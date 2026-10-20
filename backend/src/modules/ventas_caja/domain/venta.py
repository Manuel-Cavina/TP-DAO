from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal

from modules.ventas_caja.domain.comprobante import Comprobante
from modules.ventas_caja.domain.detalle_venta import Detalle_Venta
from modules.ventas_caja.domain.estrategia_pago import Estrategia_Pago
from modules.ventas_caja.domain.exceptions import Venta_Invalida_Exception


class Venta:
    """Venta de uno o más productos en un local. El total siempre se calcula desde sus líneas."""

    def __init__(self, local_id: int, fecha_hora: datetime, id: int | None = None) -> None:
        if not isinstance(local_id, int) or isinstance(local_id, bool) or local_id <= 0:
            raise Venta_Invalida_Exception("El identificador del local debe ser un entero positivo.")
        if not isinstance(fecha_hora, datetime):
            raise Venta_Invalida_Exception("La fecha y hora de la venta debe ser datetime.")

        self._id = id
        self._local_id = local_id
        self._fecha_hora = fecha_hora
        self._detalles: list[Detalle_Venta] = []
        self._comprobante: Comprobante | None = None

    @classmethod
    def reconstruir(
        cls,
        id: int,
        local_id: int,
        fecha_hora: datetime,
        detalles: Iterable[Detalle_Venta],
        comprobante: Comprobante,
    ) -> "Venta":
        """Rearma una venta ya confirmada desde la persistencia, sin volver a cobrar."""
        venta = cls(local_id, fecha_hora, id)
        venta._detalles = list(detalles)
        venta._comprobante = comprobante
        return venta

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Venta_Invalida_Exception("No se puede modificar el id de una venta ya asignado.")
        self._id = valor

    @property
    def local_id(self) -> int:
        return self._local_id

    @property
    def fecha_hora(self) -> datetime:
        return self._fecha_hora

    @property
    def detalles(self) -> tuple[Detalle_Venta, ...]:
        return tuple(self._detalles)

    @property
    def total(self) -> Decimal:
        return sum((detalle.subtotal for detalle in self._detalles), Decimal("0"))

    @property
    def comprobante(self) -> Comprobante | None:
        return self._comprobante

    @property
    def comprobante_emitido(self) -> Comprobante:
        """Comprobante de una venta confirmada; falla si todavía no se cobró."""
        if self._comprobante is None:
            raise Venta_Invalida_Exception("La venta todavía no fue confirmada ni tiene comprobante.")
        return self._comprobante

    @property
    def id_registrado(self) -> int:
        """Id de una venta ya persistida; falla si todavía no se guardó."""
        if self._id is None:
            raise Venta_Invalida_Exception("La venta todavía no fue registrada.")
        return self._id

    @property
    def esta_confirmada(self) -> bool:
        return self._comprobante is not None

    def agregar_producto(self, producto_id: int, cantidad: int, precio_unitario: Decimal) -> None:
        """Agrega una línea o suma la cantidad a la línea existente del mismo producto."""
        self._validar_modificable()
        nuevo = Detalle_Venta(producto_id, cantidad, precio_unitario)
        existente = self.buscar_detalle(producto_id)
        if existente is None:
            self._detalles.append(nuevo)
            return

        if existente.precio_unitario != precio_unitario:
            raise Venta_Invalida_Exception(
                f"El producto {producto_id} ya está en la venta con otro precio unitario."
            )
        unificado = Detalle_Venta(producto_id, existente.cantidad + cantidad, precio_unitario)
        self._detalles[self._detalles.index(existente)] = unificado

    def validar_tiene_detalles(self) -> None:
        if not self._detalles:
            raise Venta_Invalida_Exception("La venta debe tener al menos un producto.")

    def confirmar(
        self,
        estrategia: Estrategia_Pago,
        numero_comprobante: int,
        fecha_emision: datetime | None = None,
    ) -> Comprobante:
        """Cobra la venta delegando en la estrategia de pago y emite el comprobante."""
        self._validar_modificable()
        self.validar_tiene_detalles()
        resultado = estrategia.procesar_pago(self.total)
        self._comprobante = Comprobante(
            numero=numero_comprobante,
            local_id=self._local_id,
            fecha_emision=fecha_emision or self._fecha_hora,
            total=self.total,
            pago=resultado,
        )
        return self._comprobante

    def buscar_detalle(self, producto_id: int) -> Detalle_Venta | None:
        for detalle in self._detalles:
            if detalle.producto_id == producto_id:
                return detalle
        return None

    def _validar_modificable(self) -> None:
        if self.esta_confirmada:
            raise Venta_Invalida_Exception("La venta ya fue confirmada y no se puede modificar.")
