"""Convención del handler global: el sufijo de la excepción de negocio define el código HTTP."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from config.api.exception_handlers import _estado_http
from errors.business_error import BusinessError
from modules.catalogo.domain import exceptions as catalogo
from modules.logistica.domain import exceptions as logistica
from modules.reportes.domain import exceptions as reportes
from modules.ubicaciones_stock.domain.exceptions import stock_exceptions as stock
from modules.ventas_caja.domain import exceptions as ventas

MODULOS = (catalogo, logistica, reportes, stock, ventas)
ESPERADOS = {
    "Entidad_No_Encontrada_Exception": 404,
    "Venta_No_Encontrada_Exception": 404,
    "Orden_No_Encontrada_Exception": 404,
    "Bulto_No_Encontrado_Exception": 404,
    "Remito_No_Encontrado_Exception": 404,
    "Entidad_Duplicada_Exception": 409,
    "Remito_Duplicado_Exception": 409,
    "Precinto_Duplicado_Exception": 409,
}


class TestEstadoHttpNegocio(unittest.TestCase):
    def test_cada_excepcion_de_negocio_tiene_el_codigo_esperado(self) -> None:
        excepciones = {
            nombre: clase
            for modulo in MODULOS
            for nombre, clase in vars(modulo).items()
            if isinstance(clase, type) and issubclass(clase, BusinessError) and clase is not BusinessError
        }
        self.assertTrue(set(ESPERADOS) <= set(excepciones), "Falta alguna excepción esperada.")
        for nombre, clase in excepciones.items():
            with self.subTest(excepcion=nombre):
                self.assertEqual(_estado_http(clase("x")), ESPERADOS.get(nombre, 400))


if __name__ == "__main__":
    unittest.main()
