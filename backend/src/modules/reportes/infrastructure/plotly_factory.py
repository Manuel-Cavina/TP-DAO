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
