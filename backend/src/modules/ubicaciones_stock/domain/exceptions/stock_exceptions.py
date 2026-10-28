from errors.business_error import BusinessError


class Stock_Insuficiente_Exception(BusinessError):
    """La cantidad solicitada supera el stock disponible y verificado (o lo que hay en tránsito)."""


class Entidad_No_Encontrada_Exception(BusinessError):
    """No existe la ubicación o stock solicitado."""


class Ubicacion_Invalida_Exception(BusinessError):
    """Los datos de la ubicación no cumplen las reglas (nombre, dirección o tipo)."""


class Cantidad_Invalida_Exception(BusinessError):
    """Una cantidad de stock o un nivel mínimo no es un entero positivo."""


class Ingreso_No_Permitido_Exception(BusinessError):
    """La mercadería del proveedor solo ingresa al Centro de Distribución, nunca a un local."""
