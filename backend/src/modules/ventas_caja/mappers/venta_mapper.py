from modules.ventas_caja.domain import Detalle_Venta, Venta
from modules.ventas_caja.dto import Comprobante_DTO, Detalle_Venta_DTO, Venta_DTO


class Venta_Mapper:
    """Conversor entre la entidad Venta y sus DTOs de venta y comprobante."""

    @staticmethod
    def a_dto(venta: Venta) -> Venta_DTO:
        comprobante = venta.comprobante_emitido
        return Venta_DTO(
            id=venta.id_registrado,
            local_id=venta.local_id,
            fecha_hora=venta.fecha_hora.isoformat(),
            total=venta.total,
            medio_pago=comprobante.medio_pago,
            total_cobrado=comprobante.total_cobrado,
            numero_comprobante=comprobante.numero_formateado,
            detalles=[Venta_Mapper._detalle_a_dto(d) for d in venta.detalles],
        )

    @staticmethod
    def a_comprobante_dto(venta: Venta) -> Comprobante_DTO:
        comprobante = venta.comprobante_emitido
        return Comprobante_DTO(
            venta_id=venta.id_registrado,
            numero=comprobante.numero,
            numero_formateado=comprobante.numero_formateado,
            local_id=comprobante.local_id,
            fecha_emision=comprobante.fecha_emision.isoformat(),
            total=comprobante.total,
            medio_pago=comprobante.medio_pago,
            recargo=comprobante.pago.recargo,
            total_cobrado=comprobante.total_cobrado,
            vuelto=comprobante.pago.vuelto,
            detalle_pago=comprobante.pago.detalle,
            items=[Venta_Mapper._detalle_a_dto(d) for d in venta.detalles],
        )

    @staticmethod
    def _detalle_a_dto(detalle: Detalle_Venta) -> Detalle_Venta_DTO:
        return Detalle_Venta_DTO(
            producto_id=detalle.producto_id,
            cantidad=detalle.cantidad,
            precio_unitario=detalle.precio_unitario,
            subtotal=detalle.subtotal,
        )
