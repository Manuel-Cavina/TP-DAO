"""Base declarativa única para todas las entidades ORM del ERP."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Raíz del mapa ORM; las entidades de dominio heredan de esta clase."""
