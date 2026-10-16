from errors.business_error import BusinessError


class Transicion_Estado_Invalida_Exception(BusinessError):
    """La acción no está permitida para el estado actual del bulto."""


class Precinto_Invalido_Exception(BusinessError):
    """El precinto no existe, no coincide o ya fue utilizado."""


class Bulto_Vacio_Exception(BusinessError):
    """Un bulto sin contenido no puede ser precintado."""


class Remito_Incompleto_Exception(BusinessError):
    """El remito tiene bultos que todavía no están precintados."""
