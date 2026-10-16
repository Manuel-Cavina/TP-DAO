"""Errores compartidos del backend."""

from errors.business_error import BusinessError
from errors.persistence_error import Persistencia_Exception

__all__ = ["BusinessError", "Persistencia_Exception"]
