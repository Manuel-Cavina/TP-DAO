from errors.business_error import BusinessError


class Stock_Insuficiente_Exception(BusinessError):
    """La cantidad solicitada supera el stock disponible y verificado."""


class Entidad_No_Encontrada_Exception(BusinessError):
    """No existe la ubicación o stock solicitado."""
