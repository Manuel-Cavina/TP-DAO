"""Cada parámetro de query declarado en una ruta aparece con su nombre en la API publicada.

Protege contra reutilizar un mismo objeto Query(...) en dos parámetros: FastAPI se queda con
el nombre del primero y el segundo filtro se ignora en silencio.
"""

from pathlib import Path
import inspect
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi.params import Query
from fastapi.routing import APIRoute

from modules.catalogo.api import catalogo_router
from modules.logistica.api import logistica_router
from modules.reportes.api import reportes_router
from modules.ubicaciones_stock.api import stock_router, ubicaciones_router
from modules.ventas_caja.api import caja_router, ventas_router

ROUTERS = (catalogo_router, ubicaciones_router, stock_router, logistica_router, ventas_router, caja_router, reportes_router)


class TestParametrosApi(unittest.TestCase):
    def test_todos_los_parametros_de_query_estan_publicados(self) -> None:
        rutas = [r for router in ROUTERS for r in router.routes if isinstance(r, APIRoute)]
        self.assertGreater(len(rutas), 50)
        for ruta in rutas:
            # El alias es el nombre con el que FastAPI lee el parámetro de la URL.
            publicados = {p.alias for p in ruta.dependant.query_params}
            declarados = {
                nombre
                for nombre, parametro in inspect.signature(ruta.endpoint).parameters.items()
                if isinstance(parametro.default, Query) or nombre in publicados
            }
            with self.subTest(ruta=ruta.path, metodo=sorted(ruta.methods)):
                self.assertEqual(declarados, publicados)


if __name__ == "__main__":
    unittest.main()
