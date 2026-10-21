"""Adaptador de visualización para los reportes del sistema."""

from collections.abc import Sequence
from decimal import Decimal
from typing import Any

import plotly.graph_objects as go


def crear_grafico_ventas_por_periodo(
    etiquetas: Sequence[str], totales: Sequence[Decimal], titulo: str = "Ventas por período"
) -> dict[str, Any]:
    """Construye un gráfico serializable para que el frontend lo renderice con Plotly.js."""
    if len(etiquetas) != len(totales):
        raise ValueError("Cada período debe tener un total de ventas.")

    figura = go.Figure(
        data=[
            go.Bar(
                x=list(etiquetas),
                y=[float(total) for total in totales],
                marker_color="#2563eb",
                hovertemplate="%{x}<br>$ %{y:,.2f}<extra></extra>",
            )
        ]
    )
    figura.update_layout(
        title=titulo,
        template="plotly_white",
        xaxis_title="Período",
        yaxis_title="Ingresos",
        margin={"l": 56, "r": 24, "t": 64, "b": 48},
    )
    return figura.to_plotly_json()


PALETA = ("#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2")
COLOR_ALERTA = "#dc2626"


def crear_grafico_barras(
    etiquetas: Sequence[str],
    series: dict[str, Sequence[Decimal | int]],
    titulo: str,
    eje_x: str,
    eje_y: str,
    destacadas: Sequence[bool] | None = None,
) -> dict[str, Any]:
    """Barras agrupadas (una por serie) serializadas para Plotly.js.

    `destacadas` pinta en rojo las barras de la primera serie que requieren atención
    (margen negativo, stock bajo mínimo).
    """
    if any(len(valores) != len(etiquetas) for valores in series.values()):
        raise ValueError("Cada serie debe tener un valor por etiqueta.")

    barras = []
    for indice, (nombre, valores) in enumerate(series.items()):
        color: str | list[str] = PALETA[indice % len(PALETA)]
        if indice == 0 and destacadas is not None:
            color = [COLOR_ALERTA if marcar else PALETA[0] for marcar in destacadas]
        barras.append(go.Bar(name=nombre, x=list(etiquetas), y=[float(v) for v in valores], marker_color=color))

    figura = go.Figure(data=barras)
    figura.update_layout(
        title=titulo,
        template="plotly_white",
        barmode="group",
        xaxis_title=eje_x,
        yaxis_title=eje_y,
        margin={"l": 56, "r": 24, "t": 64, "b": 48},
    )
    return figura.to_plotly_json()
