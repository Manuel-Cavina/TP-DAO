from errors.business_error import BusinessError


class Stock_Insuficiente_Exception(BusinessError):
    """La cantidad solicitada supera el stock disponible o en tránsito."""


class Entidad_No_Encontrada_Exception(BusinessError):
    """No existe la ubicación o stock solicitado."""


class Entidad_Duplicada_Exception(BusinessError):
    """Ya existe la entidad (por ejemplo, ya existe un Centro de Distribución o par producto-ubicación)."""


class Datos_Invalidos_Exception(BusinessError):
    """Los datos recibidos no cumplen las reglas de negocio de ubicaciones o stock."""


class Ubicacion_Con_Stock_Exception(BusinessError):
    """No se puede dar de baja una ubicación que posee existencias disponibles o en tránsito."""
