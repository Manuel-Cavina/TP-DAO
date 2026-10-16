from errors.business_error import BusinessError


class Rango_Fechas_Invalido_Exception(BusinessError):
    """La fecha de inicio no puede ser posterior a la fecha de fin."""
