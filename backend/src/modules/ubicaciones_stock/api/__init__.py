"""Puntos de entrada HTTP de ubicaciones y stock."""

from modules.ubicaciones_stock.api.stock_router import router as stock_router
from modules.ubicaciones_stock.api.ubicaciones_router import router as ubicaciones_router

__all__ = ["stock_router", "ubicaciones_router"]
