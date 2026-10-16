from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.estado_bulto import (
    Estado_En_Transito,
    Estado_Precintado,
    Estado_Preparado,
    Estado_Rechazado,
    Estado_Recibido,
    Estado_Verificado,
)
from modules.logistica.domain.exceptions import (
    Bulto_Vacio_Exception,
    Precinto_Invalido_Exception,
    Transicion_Estado_Invalida_Exception,
)
from modules.logistica.domain.precinto import Precinto


class TestStateBulto(unittest.TestCase):
    """Pruebas unitarias para el patron State y el ciclo de vida del bulto."""

    def setUp(self) -> None:
        self.bulto = Bulto(id=1, orden_id=10)
        self.detalle = Detalle_Bulto(producto_id="PROD-001", cantidad=5)
        self.precinto_valido = Precinto(codigo="PREC-12345", esta_intacto=True)

    def test_estado_inicial_es_preparado(self) -> None:
        self.assertEqual(self.bulto.estado.nombre, "PREPARADO")
        self.assertIsInstance(self.bulto.estado, Estado_Preparado)
        self.assertEqual(len(self.bulto.historial), 1)
        self.assertEqual(self.bulto.historial[0].estado_nuevo, "PREPARADO")

    def test_no_se_puede_precintar_bulto_vacio(self) -> None:
        with self.assertRaises(Bulto_Vacio_Exception):
            self.bulto.precintar(self.precinto_valido)

    def test_no_se_puede_precintar_con_precinto_roto(self) -> None:
        self.bulto.agregar_detalle(self.detalle)
        precinto_roto = Precinto(codigo="PREC-ROTO", esta_intacto=False)
        with self.assertRaises(Precinto_Invalido_Exception):
            self.bulto.precintar(precinto_roto)

    def test_transicion_exitosa_hasta_verificado(self) -> None:
        # 1. Preparado -> Precintado
        self.bulto.agregar_detalle(self.detalle)
        self.bulto.precintar(self.precinto_valido)
        self.assertIsInstance(self.bulto.estado, Estado_Precintado)
        self.assertEqual(self.bulto.precinto.codigo, "PREC-12345")

        # 2. Precintado -> En Transito
        self.bulto.despachar()
        self.assertIsInstance(self.bulto.estado, Estado_En_Transito)

        # 3. En Transito -> Recibido
        self.bulto.recibir()
        self.assertIsInstance(self.bulto.estado, Estado_Recibido)

        # 4. Recibido -> Verificado (precinto conforme e intacto)
        self.bulto.verificar(codigo_precinto_recibido="PREC-12345", esta_intacto=True)
        self.assertIsInstance(self.bulto.estado, Estado_Verificado)

        # Verificar historial inmutable completo
        historial = self.bulto.historial
        estados_recorridos = [h.estado_nuevo for h in historial]
        self.assertEqual(
            estados_recorridos,
            ["PREPARADO", "PRECINTADO", "EN_TRANSITO", "RECIBIDO", "VERIFICADO"],
        )

    def test_rechazo_por_precinto_violado(self) -> None:
        self.bulto.agregar_detalle(self.detalle)
        self.bulto.precintar(self.precinto_valido)
        self.bulto.despachar()
        self.bulto.recibir()

        # Llega con precinto roto
        self.bulto.verificar(codigo_precinto_recibido="PREC-12345", esta_intacto=False)
        self.assertIsInstance(self.bulto.estado, Estado_Rechazado)
        self.assertEqual(self.bulto.historial[-1].estado_nuevo, "RECHAZADO")
        self.assertIn("roto o violado", self.bulto.historial[-1].observacion)

    def test_rechazo_por_codigo_adulterado(self) -> None:
        self.bulto.agregar_detalle(self.detalle)
        self.bulto.precintar(self.precinto_valido)
        self.bulto.despachar()
        self.bulto.recibir()

        # Llega con codigo distinto
        self.bulto.verificar(codigo_precinto_recibido="PREC-OTRO", esta_intacto=True)
        self.assertIsInstance(self.bulto.estado, Estado_Rechazado)
        self.assertEqual(self.bulto.historial[-1].estado_nuevo, "RECHAZADO")
        self.assertIn("no coincide", self.bulto.historial[-1].observacion)

    def test_transiciones_invalidas_lanzan_excepcion(self) -> None:
        # No se puede despachar directamente desde PREPARADO
        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.despachar()

        # No se puede recibir directamente desde PREPARADO
        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.recibir()

        # No se puede verificar directamente desde PREPARADO
        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.verificar("PREC-12345", True)

    def test_estados_terminales_no_admiten_acciones(self) -> None:
        self.bulto.agregar_detalle(self.detalle)
        self.bulto.precintar(self.precinto_valido)
        self.bulto.despachar()
        self.bulto.recibir()
        self.bulto.verificar("PREC-12345", True)

        # Estado VERIFICADO es terminal
        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.precintar(self.precinto_valido)

        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.despachar()

        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.recibir()

        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.verificar("PREC-12345", True)

    def test_no_se_puede_agregar_detalle_despues_de_precintar(self) -> None:
        self.bulto.agregar_detalle(self.detalle)
        self.bulto.precintar(self.precinto_valido)
        with self.assertRaises(Transicion_Estado_Invalida_Exception):
            self.bulto.agregar_detalle(Detalle_Bulto("PROD-002", 10))


if __name__ == "__main__":
    unittest.main()
