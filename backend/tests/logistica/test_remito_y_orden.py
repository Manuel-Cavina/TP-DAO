from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.exceptions import (
    Orden_Invalida_Exception,
    Remito_Incompleto_Exception,
)
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.domain.precinto import Precinto
from modules.logistica.domain.remito import Remito


class TestRemitoYOrden(unittest.TestCase):
    """Pruebas unitarias para las entidades Remito y Orden_Reposicion."""

    def test_orden_reposicion_control_cantidades(self) -> None:
        detalle = Detalle_Orden_Reposicion(producto_id="P1", cantidad_solicitada=10)
        detalle.registrar_envio(4)
        self.assertEqual(detalle.cantidad_enviada, 4)

        # No puede superar la cantidad solicitada
        with self.assertRaises(Orden_Invalida_Exception):
            detalle.registrar_envio(7)

    def test_orden_reposicion_ciclo_estados(self) -> None:
        orden = Orden_Reposicion(origen_id="CD-CENTRAL", destino_id="LOCAL-01", id=1)
        orden.agregar_detalle(Detalle_Orden_Reposicion("P1", 10))
        self.assertEqual(orden.estado, "PENDIENTE")

        orden.iniciar_preparacion()
        self.assertEqual(orden.estado, "EN_PREPARACION")

        orden.despachar()
        self.assertEqual(orden.estado, "DESPACHADA")

        orden.cerrar()
        self.assertEqual(orden.estado, "CERRADA")

    def test_remito_no_permite_despachar_con_bulto_no_precintado(self) -> None:
        bulto1 = Bulto(id=1, orden_id=10, detalles=[Detalle_Bulto("P1", 5)])
        bulto1.precintar(Precinto("PREC-1"))

        bulto2 = Bulto(id=2, orden_id=10, detalles=[Detalle_Bulto("P1", 5)])
        # bulto2 queda en PREPARADO

        remito = Remito(numero="REM-0001", origen_id="CD-CENTRAL", destino_id="LOCAL-01")
        remito.agregar_bulto(bulto1)

        # No se puede agregar bulto en preparacion
        with self.assertRaises(Remito_Incompleto_Exception):
            remito.agregar_bulto(bulto2)

    def test_remito_despacho_y_cierre_exitoso(self) -> None:
        bulto1 = Bulto(id=1, orden_id=10, detalles=[Detalle_Bulto("P1", 5)])
        bulto1.precintar(Precinto("PREC-1"))

        remito = Remito(numero="REM-0001", origen_id="CD-CENTRAL", destino_id="LOCAL-01", bultos=[bulto1])
        remito.despachar()
        self.assertEqual(remito.estado, "DESPACHADO")
        self.assertEqual(bulto1.estado.nombre, "EN_TRANSITO")

        remito.recibir()
        self.assertEqual(bulto1.estado.nombre, "RECIBIDO")

        # Intentar cerrar antes de verificar falla
        with self.assertRaises(Remito_Incompleto_Exception):
            remito.cerrar()

        # Se verifica el bulto y ahora si se puede cerrar
        bulto1.verificar("PREC-1", esta_intacto=True)
        remito.cerrar()
        self.assertEqual(remito.estado, "CERRADO")


if __name__ == "__main__":
    unittest.main()
