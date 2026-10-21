"""Consultas de solo lectura y gráficos de reportes."""

from modules.reportes.infrastructure.plotly_factory import crear_grafico_barras, crear_grafico_ventas_por_periodo
from modules.reportes.infrastructure.reportes_repository import Reportes_Repository

__all__ = ["Reportes_Repository", "crear_grafico_barras", "crear_grafico_ventas_por_periodo"]
