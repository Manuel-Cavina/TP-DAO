from errors.business_error import BusinessError


class Entidad_Duplicada_Exception(BusinessError):
    """El identificador de producto o proveedor ya está registrado."""


class Datos_Invalidos_Exception(BusinessError):
    """Los datos recibidos no cumplen las precondiciones del catálogo."""


class Entidad_No_Encontrada_Exception(BusinessError):
    """No existe la entidad del catálogo solicitada."""
