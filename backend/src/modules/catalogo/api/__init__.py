"""Puntos de entrada HTTP del modulo catalogo."""

from modules.catalogo.api.catalogo_router import router as catalogo_router

__all__ = ["catalogo_router"]
