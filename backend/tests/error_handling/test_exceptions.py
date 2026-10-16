from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from errors.business_error import BusinessError
from errors.persistence_error import Persistencia_Exception
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception
from modules.logistica.domain.exceptions import Transicion_Estado_Invalida_Exception
from modules.reportes.domain.exceptions import Rango_Fechas_Invalido_Exception
from modules.ventas_caja.domain.exceptions import Devolucion_Invalida_Exception


class ExceptionsTests(unittest.TestCase):
    def test_todas_las_reglas_de_negocio_heredan_de_business_error(self) -> None:
        business_exceptions = [
            Entidad_Duplicada_Exception,
            Transicion_Estado_Invalida_Exception,
            Devolucion_Invalida_Exception,
            Rango_Fechas_Invalido_Exception,
        ]

        for exception_type in business_exceptions:
            with self.subTest(exception_type=exception_type.__name__):
                self.assertTrue(issubclass(exception_type, BusinessError))

    def test_error_de_persistencia_no_es_regla_de_negocio(self) -> None:
        self.assertFalse(issubclass(Persistencia_Exception, BusinessError))
