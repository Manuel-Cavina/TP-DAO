from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Generic, TypeVar

from modules.reportes.domain import (
    Existencia,
    Merma_Bulto,
    Producto_Vendido,
    Rango_Fechas,
    Tiempo_Transito_Local,
    Ventas_Por_Medio_Pago,
)
from modules.reportes.infrastructure.plotly_factory import crear_grafico_barras
from modules.reportes.infrastructure.reportes_repository import Reportes_Repository

Fila = TypeVar("Fila")
TOP_N_POR_DEFECTO = 10


@dataclass(frozen=True)
class Resultado_Reporte(Generic[Fila]):
    """Filas del reporte, totales agregados y el gráfico Plotly listo para el frontend."""

    filas: list[Fila]
    totales: dict[str, Decimal | int] = field(default_factory=dict)
    grafico: dict[str, Any] = field(default_factory=dict)


class Reportes_Service:
    """Los reportes no triviales de la consigna. Solo leen: nunca modifican datos."""

    def __init__(self, repository: Reportes_Repository | None = None) -> None:
        self._repository = repository if repository is not None else Reportes_Repository()

    def ventas_por_periodo(
        self, desde: date, hasta: date, local_id: int | None = None
    ) -> Resultado_Reporte[Ventas_Por_Medio_Pago]:
        """1. Ventas e ingresos por período, local y medio de pago (bruto, devoluciones y neto)."""
        filas = self._repository.ventas_por_local_y_medio(Rango_Fechas(desde, hasta), local_id)
        locales = sorted({f.local_nombre for f in filas})
        medios = sorted({f.medio_pago for f in filas})
        neto = {(f.local_nombre, f.medio_pago): f.total_neto for f in filas}
        grafico = crear_grafico_barras(
            locales,
            {medio: [neto.get((local, medio), Decimal("0")) for local in locales] for medio in medios},
            titulo="Ingresos netos por local y medio de pago",
            eje_x="Local",
            eje_y="Total neto ($)",
        )
        totales = {
            "cantidad_ventas": sum(f.cantidad_ventas for f in filas),
            "total_bruto": sum((f.total_bruto for f in filas), Decimal("0.00")),
            "total_devoluciones": sum((f.total_devoluciones for f in filas), Decimal("0.00")),
            "total_neto": sum((f.total_neto for f in filas), Decimal("0.00")),
        }
        return Resultado_Reporte(filas, totales, grafico)

    def productos_mas_vendidos(
        self, desde: date, hasta: date, top: int = TOP_N_POR_DEFECTO
    ) -> Resultado_Reporte[Producto_Vendido]:
        """2. Productos más vendidos (unidades netas) con margen de ganancia o pérdida estimado."""
        filas = sorted(
            self._repository.productos_vendidos(Rango_Fechas(desde, hasta)),
            key=lambda f: (-f.unidades_netas, -f.ingresos, f.codigo),
        )[:top]
        grafico = crear_grafico_barras(
            [f.codigo for f in filas],
            {"Margen ($)": [f.margen for f in filas], "Ingresos ($)": [f.ingresos for f in filas]},
            titulo="Productos más vendidos: margen e ingresos (rojo = pérdida)",
            eje_x="Producto",
            eje_y="$",
            destacadas=[f.margen_negativo for f in filas],
        )
        totales = {
            "unidades_netas": sum(f.unidades_netas for f in filas),
            "ingresos": sum((f.ingresos for f in filas), Decimal("0.00")),
            "margen": sum((f.margen for f in filas), Decimal("0.00")),
            "productos_con_perdida": sum(1 for f in filas if f.margen_negativo),
        }
        return Resultado_Reporte(filas, totales, grafico)

    def existencias(self, ubicacion_id: int | None = None) -> Resultado_Reporte[Existencia]:
        """3. Existencias actuales, faltantes contra el mínimo y valorización del inventario."""
        filas = self._repository.existencias(ubicacion_id)
        valor_por_ubicacion: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        bajo_minimo_por_ubicacion: dict[str, int] = defaultdict(int)
        for f in filas:
            valor_por_ubicacion[f.ubicacion_nombre] += f.valorizacion
            bajo_minimo_por_ubicacion[f.ubicacion_nombre] += int(f.en_o_bajo_minimo)
        ubicaciones = list(valor_por_ubicacion)
        grafico = crear_grafico_barras(
            ubicaciones,
            {"Valorización ($)": [valor_por_ubicacion[u] for u in ubicaciones]},
            titulo="Valorización del inventario por ubicación (rojo = hay productos bajo mínimo)",
            eje_x="Ubicación",
            eje_y="$",
            destacadas=[bajo_minimo_por_ubicacion[u] > 0 for u in ubicaciones],
        )
        totales = {
            "valorizacion": sum((f.valorizacion for f in filas), Decimal("0.00")),
            "productos_en_o_bajo_minimo": sum(1 for f in filas if f.en_o_bajo_minimo),
            "unidades_faltantes": sum(f.faltante for f in filas),
        }
        return Resultado_Reporte(filas, totales, grafico)

    def mermas(self, desde: date, hasta: date, local_id: int | None = None) -> Resultado_Reporte[Merma_Bulto]:
        """4. Bultos rechazados por precinto violado: unidades y valor perdido, con totales por local."""
        filas = self._repository.mermas(Rango_Fechas(desde, hasta), local_id)
        valor_por_local: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        unidades_por_local: dict[str, int] = defaultdict(int)
        for f in filas:
            valor_por_local[f.local_nombre] += f.valor_perdido
            unidades_por_local[f.local_nombre] += f.unidades_perdidas
        locales = list(valor_por_local)
        grafico = crear_grafico_barras(
            locales,
            {
                "Valor perdido ($)": [valor_por_local[local] for local in locales],
                "Unidades": [unidades_por_local[local] for local in locales],
            },
            titulo="Mermas por rotura de precinto, por local",
            eje_x="Local",
            eje_y="Pérdida",
        )
        totales = {
            "bultos_rechazados": len(filas),
            "unidades_perdidas": sum(f.unidades_perdidas for f in filas),
            "valor_perdido": sum((f.valor_perdido for f in filas), Decimal("0.00")),
        }
        return Resultado_Reporte(filas, totales, grafico)

    def tiempos_transito(self, desde: date, hasta: date) -> Resultado_Reporte[Tiempo_Transito_Local]:
        """5. Tiempo de tránsito CD -> local (promedio, mínimo y máximo), desde el historial inmutable."""
        filas = self._repository.tiempos_transito(Rango_Fechas(desde, hasta))
        grafico = crear_grafico_barras(
            [f.local_nombre for f in filas],
            {
                "Promedio (h)": [f.promedio_horas for f in filas],
                "Máximo (h)": [f.maximo_horas for f in filas],
            },
            titulo="Tiempo de tránsito CD → local",
            eje_x="Local",
            eje_y="Horas",
        )
        totales = {"bultos_recibidos": sum(f.cantidad_bultos for f in filas)}
        return Resultado_Reporte(filas, totales, grafico)
