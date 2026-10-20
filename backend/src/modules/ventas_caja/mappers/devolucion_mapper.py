from modules.ventas_caja.domain import Devolucion
from modules.ventas_caja.dto import Detalle_Devolucion_DTO, Devolucion_DTO


class Devolucion_Mapper:
    """Conversor entre la entidad Devolucion y Devolucion_DTO."""

    @staticmethod
    def a_dto(devolucion: Devolucion) -> Devolucion_DTO:
        return Devolucion_DTO(
            id=devolucion.id_registrado,
            venta_id=devolucion.venta.id_registrado,
            local_id=devolucion.local_id,
            fecha_hora=devolucion.fecha_hora.isoformat(),
            motivo=devolucion.motivo,
            medio_pago=devolucion.medio_pago,
            monto_reintegrado=devolucion.monto_reintegrado,
            detalles=[
                Detalle_Devolucion_DTO(
                    producto_id=d.producto_id,
                    cantidad=d.cantidad,
                    precio_unitario=d.precio_unitario,
                    monto=d.monto,
                )
                for d in devolucion.detalles
            ],
        )
