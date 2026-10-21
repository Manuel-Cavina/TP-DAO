"""Repositorios ORM de catalogo."""

from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository
from modules.catalogo.infrastructure.models import Categoria_Model, Producto_Model, Proveedor_Model
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository

__all__ = [
    "Categoria_Model",
    "Categoria_Repository",
    "Producto_Model",
    "Producto_Repository",
    "Proveedor_Model",
    "Proveedor_Repository",
]
