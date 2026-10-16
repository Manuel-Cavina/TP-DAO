from errors.business_error import BusinessError


class Stock_Insuficiente_Exception(BusinessError):
    """La venta solicita más unidades que las disponibles en el local."""


class Venta_No_Encontrada_Exception(BusinessError):
    """No existe la venta o no pertenece al local indicado."""


class Devolucion_Invalida_Exception(BusinessError):
    """La devolución no cumple las reglas acordadas para la venta."""


class Pago_Rechazado_Exception(BusinessError):
    """El medio de pago no pudo procesar el cobro."""
