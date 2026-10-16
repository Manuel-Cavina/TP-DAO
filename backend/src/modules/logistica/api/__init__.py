"""Puntos de entrada HTTP del modulo de logistica."""

from modules.logistica.api.logistica_router import router as logistica_router

__all__ = ["logistica_router"]
