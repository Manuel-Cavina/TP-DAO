"""Excepciones de negocio del módulo de seguridad."""

from errors.business_error import BusinessError


class Credenciales_Invalidas_Exception(BusinessError):
    """Lanzada cuando las credenciales suministradas son erróneas o el usuario no existe."""


class Usuario_Inactivo_Exception(BusinessError):
    """Lanzada cuando un usuario inactivo intenta autenticarse o realizar operaciones."""


class Sesion_Invalida_Exception(BusinessError):
    """Lanzada cuando el token de sesión es erróneo, inexistente o fue revocado."""


class Sesion_Expirada_Exception(BusinessError):
    """Lanzada cuando la sesión ha superado su tiempo de validez."""


class Csrf_Invalido_Exception(BusinessError):
    """Lanzada cuando el token CSRF está ausente o no coincide con la sesión."""


class Permiso_Insuficiente_Exception(BusinessError):
    """Lanzada cuando un usuario no posee los permisos requeridos para una operación."""
