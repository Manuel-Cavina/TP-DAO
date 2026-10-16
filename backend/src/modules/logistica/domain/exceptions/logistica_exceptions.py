from errors.business_error import BusinessError


class Transicion_Estado_Invalida_Exception(BusinessError):
    """Se lanza cuando una operacion no esta permitida para el estado actual del bulto."""


class Precinto_Invalido_Exception(BusinessError):
    """Se lanza cuando el precinto no existe, ya fue utilizado o no es valido."""


class Bulto_Vacio_Exception(BusinessError):
    """Se lanza cuando se intenta precintar o despachar un bulto sin mercaderia."""


class Remito_Incompleto_Exception(BusinessError):
    """Se lanza cuando un remito contiene bultos en estados invalidos para ser despachado o cerrado."""


class Orden_Invalida_Exception(BusinessError):
    """Se lanza cuando una operacion de la orden de reposicion viola reglas del negocio."""
