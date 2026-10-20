"""Puntos de entrada HTTP del modulo de ventas y caja."""

from modules.ventas_caja.api.caja_router import router as caja_router
from modules.ventas_caja.api.ventas_router import router as ventas_router

__all__ = ["caja_router", "ventas_router"]
