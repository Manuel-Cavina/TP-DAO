from errors.business_error import BusinessError


class Transicion_Estado_Invalida_Exception(BusinessError):
    """La acción no está permitida para el estado actual del bulto."""


class Precinto_Invalido_Exception(BusinessError):
    """El precinto no existe, no coincide o ya fue utilizado."""


class Bulto_Vacio_Exception(BusinessError):
    """Un bulto sin contenido no puede ser precintado."""


class Bulto_Invalido_Exception(BusinessError):
    """El contenido del bulto no cumple las reglas (producto o cantidad inválidos)."""


class Remito_Incompleto_Exception(BusinessError):
    """El remito tiene bultos que todavía no están precintados o listos para operar."""


class Orden_Invalida_Exception(BusinessError):
    """Se lanza cuando una operación de la orden de reposición viola reglas del negocio."""


class Orden_No_Encontrada_Exception(BusinessError):
    """No existe la orden de reposición solicitada."""


class Bulto_No_Encontrado_Exception(BusinessError):
    """No existe el bulto solicitado."""


class Remito_No_Encontrado_Exception(BusinessError):
    """No existe el remito solicitado."""


class Remito_Duplicado_Exception(BusinessError):
    """Ya existe un remito con el mismo número."""


class Precinto_Duplicado_Exception(BusinessError):
    """Ya existe un precinto registrado con el mismo código."""


class Bulto_Ya_Aprobado_Exception(BusinessError):
    """El bulto ya cuenta con evidencia inmutable de aprobación registrada."""
