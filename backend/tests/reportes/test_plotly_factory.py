from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.reportes.infrastructure.plotly_factory import crear_grafico_ventas_por_periodo


class PlotlyFactoryTests(unittest.TestCase):
    def test_crea_grafico_serializable(self) -> None:
        graph = crear_grafico_ventas_por_periodo(["Enero"], [Decimal("1500.50")])

        self.assertEqual(graph["data"][0]["type"], "bar")
        self.assertEqual(graph["data"][0]["y"], [1500.5])

    def test_rechaza_cantidades_distintas(self) -> None:
        with self.assertRaises(ValueError):
            crear_grafico_ventas_por_periodo(["Enero"], [])
