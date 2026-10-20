from datetime import datetime

from modules.ventas_caja.application.catalogo_venta_contract import Catalogo_Venta_Contract
from modules.ventas_caja.application.stock_venta_contract import Stock_Venta_Contract
from modules.ventas_caja.domain import Estrategia_Pago, Venta
from modules.ventas_caja.domain.exceptions import Stock_Insuficiente_Exception, Venta_No_Encontrada_Exception
from modules.ventas_caja.infrastructure.venta_repository import Venta_Repository


class Venta_Service:
    """Caso de uso de venta (P7): arma, valida stock (V3), cobra, emite comprobante y descuenta.

    Todo ocurre en la transacción de la petición: si algo falla se propaga la
    excepción y el middleware revierte venta, comprobante y stock juntos.
    """

    def __init__(
        self,
        stock: Stock_Venta_Contract,
        catalogo: Catalogo_Venta_Contract,
        venta_repository: Venta_Repository | None = None,
    ) -> None:
        self._stock = stock
        self._catalogo = catalogo
        self._venta_repository = venta_repository if venta_repository is not None else Venta_Repository()

    def registrar_venta(
        self,
        local_id: int,
        items: list[tuple[int, int]],
        estrategia: Estrategia_Pago,
        fecha_hora: datetime | None = None,
    ) -> Venta:
        """Registra una venta con (producto_id, cantidad) por ítem y la cobra con la estrategia dada."""
        self._stock.validar_local(local_id)
        venta = Venta(local_id=local_id, fecha_hora=fecha_hora or datetime.now())
        for producto_id, cantidad in items:
            precio = self._catalogo.obtener_precio_venta(producto_id)
            venta.agregar_producto(producto_id, cantidad, precio)
        venta.validar_tiene_detalles()

        self._validar_stock_de_todas_las_lineas(venta)

        numero = self._venta_repository.siguiente_numero_comprobante(local_id)
        venta.confirmar(estrategia, numero)
        for detalle in venta.detalles:
            self._stock.descontar_por_venta(detalle.producto_id, local_id, detalle.cantidad)
        return self._venta_repository.guardar(venta)

    def obtener_venta(self, venta_id: int) -> Venta:
        venta = self._venta_repository.obtener_por_id(venta_id)
        if venta is None:
            raise Venta_No_Encontrada_Exception(f"No existe la venta {venta_id}.")
        return venta

    def listar_ventas(
        self,
        local_id: int | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
    ) -> list[Venta]:
        return self._venta_repository.listar(local_id, desde, hasta)

    def _validar_stock_de_todas_las_lineas(self, venta: Venta) -> None:
        """V3: si una sola línea no alcanza se rechaza la venta completa, antes de descontar nada."""
        faltantes = []
        for detalle in venta.detalles:
            disponible = self._stock.consultar_disponible(detalle.producto_id, venta.local_id)
            if detalle.cantidad > disponible:
                faltantes.append(
                    f"producto {detalle.producto_id}: pedido {detalle.cantidad}, disponible {disponible}"
                )
        if faltantes:
            raise Stock_Insuficiente_Exception(
                f"Stock insuficiente en el local {venta.local_id} ({'; '.join(faltantes)})."
            )
