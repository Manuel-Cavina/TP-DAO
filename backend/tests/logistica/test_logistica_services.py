from contextlib import contextmanager
from pathlib import Path
import sqlite3
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.logistica.application import (
    Despacho_Service,
    Empaquetado_Service,
    Mock_Stock_Service,
    Recepcion_Service,
    Reposicion_Service,
    Trazabilidad_Service,
)
from modules.logistica.domain.exceptions import (
    Orden_Invalida_Exception,
    Precinto_Invalido_Exception,
    Remito_Incompleto_Exception,
)
from modules.logistica.infrastructure import (
    Bulto_Repository,
    Historial_Bulto_Repository,
    Necesidad_Reposicion_Repository,
    Orden_Reposicion_Repository,
    Precinto_Repository,
    Remito_Repository,
    crear_tablas_logistica,
)


class TestLogisticaServices(unittest.TestCase):
    """Pruebas de integracion para los servicios de aplicacion del modulo logistica."""

    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        crear_tablas_logistica(self.conn)

        @contextmanager
        def in_memory_connection_factory():
            try:
                yield self.conn
                self.conn.commit()
            except Exception:
                self.conn.rollback()
                raise

        self.conn_factory = in_memory_connection_factory
        self.stock_mock = Mock_Stock_Service()

        self.orden_repo = Orden_Reposicion_Repository()
        self.necesidad_repo = Necesidad_Reposicion_Repository()
        self.bulto_repo = Bulto_Repository()
        self.precinto_repo = Precinto_Repository()
        self.remito_repo = Remito_Repository(self.bulto_repo)
        self.historial_repo = Historial_Bulto_Repository()

        self.reposicion_service = Reposicion_Service(
            self.orden_repo, self.necesidad_repo, self.conn_factory
        )
        self.empaquetado_service = Empaquetado_Service(
            self.bulto_repo,
            self.orden_repo,
            self.precinto_repo,
            self.remito_repo,
            self.stock_mock,
            self.conn_factory,
        )
        self.despacho_service = Despacho_Service(
            self.remito_repo,
            self.bulto_repo,
            self.orden_repo,
            self.stock_mock,
            self.conn_factory,
        )
        self.recepcion_service = Recepcion_Service(
            self.remito_repo,
            self.bulto_repo,
            self.orden_repo,
            self.stock_mock,
            self.conn_factory,
        )
        self.trazabilidad_service = Trazabilidad_Service(
            self.historial_repo, self.bulto_repo, self.conn_factory
        )

    def tearDown(self) -> None:
        self.conn.close()

    def test_flujo_completo_happy_path_y_merma(self) -> None:
        """Prueba de extremo a extremo del flujo logistico (Happy Path P3 a P6 y regla V1)."""
        # 1. P3: Necesidades y consolidacion
        self.reposicion_service.registrar_necesidad("PROD-A", "LOCAL-CENTRO", 10)
        self.reposicion_service.registrar_necesidad("PROD-B", "LOCAL-CENTRO", 5)

        orden = self.reposicion_service.consolidar_necesidades_en_orden("LOCAL-CENTRO", "CD-CENTRAL")
        self.assertIsNotNone(orden.id)
        self.assertEqual(orden.estado, "PENDIENTE")
        self.assertEqual(len(orden.detalles), 2)

        # 2. P4: Empaquetar
        # Bulto 1 con PROD-A
        bulto1 = self.empaquetado_service.crear_bulto(orden.id, [{"producto_id": "PROD-A", "cantidad": 10}])
        # Bulto 2 con PROD-B
        bulto2 = self.empaquetado_service.crear_bulto(orden.id, [{"producto_id": "PROD-B", "cantidad": 5}])

        # Verificar que se llamo al contrato reservar_para_despacho en CD
        reservas = [op for op in self.stock_mock.operaciones if op[0] == "RESERVAR"]
        self.assertEqual(len(reservas), 2)

        # Precintos
        self.empaquetado_service.registrar_precinto("PREC-AAA")
        self.empaquetado_service.registrar_precinto("PREC-BBB")

        bulto1 = self.empaquetado_service.precintar_bulto(bulto1.id, "PREC-AAA")
        bulto2 = self.empaquetado_service.precintar_bulto(bulto2.id, "PREC-BBB")
        self.assertEqual(bulto1.estado.nombre, "PRECINTADO")
        self.assertEqual(bulto2.estado.nombre, "PRECINTADO")

        # Emision de Remito
        remito = self.empaquetado_service.generar_remito("REM-900", orden.id, [bulto1.id, bulto2.id])
        self.assertEqual(remito.numero, "REM-900")
        self.assertEqual(remito.estado, "EMITIDO")

        # 3. P5: Despacho de Remito
        remito_despachado = self.despacho_service.despachar_remito("REM-900")
        self.assertEqual(remito_despachado.estado, "DESPACHADO")

        # Contrato: mercaderia registrada en transito en destino
        en_transito_ops = [op for op in self.stock_mock.operaciones if op[0] == "EN_TRANSITO"]
        self.assertEqual(len(en_transito_ops), 2)

        # 4. P6: Recepcion en Local
        remito_recibido = self.recepcion_service.recibir_remito("REM-900")
        self.assertEqual(remito_recibido.bultos[0].estado.nombre, "RECIBIDO")
        self.assertEqual(remito_recibido.bultos[1].estado.nombre, "RECIBIDO")

        # Verificacion física:
        # Bulto 1 precinto intacto -> VERIFICADO
        b1_verif = self.recepcion_service.verificar_bulto(bulto1.id, "PREC-AAA", esta_intacto=True)
        self.assertEqual(b1_verif.estado.nombre, "VERIFICADO")

        # Bulto 2 precinto roto -> RECHAZADO
        b2_rech = self.recepcion_service.verificar_bulto(bulto2.id, "PREC-BBB", esta_intacto=False)
        self.assertEqual(b2_rech.estado.nombre, "RECHAZADO")

        # 5. Cierre de remito e impacto en stock (V1)
        resumen = self.recepcion_service.cerrar_remito("REM-900")
        self.assertEqual(resumen["estado"], "CERRADO")
        self.assertEqual(resumen["bultos_verificados"], 1)
        self.assertEqual(resumen["bultos_rechazados"], 1)
        self.assertEqual(resumen["unidades_acreditadas"], 10)
        self.assertEqual(resumen["unidades_merma"], 5)

        # Verificar llamadas al contrato de stock de Integrante 1
        acreditaciones = [op for op in self.stock_mock.operaciones if op[0] == "ACREDITAR"]
        mermas = [op for op in self.stock_mock.operaciones if op[0] == "MERMA"]
        self.assertEqual(len(acreditaciones), 1)
        self.assertEqual(acreditaciones[0][1], "PROD-A")  # PROD-A acreditado en disponible
        self.assertEqual(len(mermas), 1)
        self.assertEqual(mermas[0][1], "PROD-B")  # PROD-B registrado como merma

        # 6. Trazabilidad inmutable V2
        trazabilidad = self.trazabilidad_service.consultar_resumen_trazabilidad(bulto1.id)
        self.assertEqual(trazabilidad["estado_actual"], "VERIFICADO")
        nombres_eventos = [e["estado_nuevo"] for e in trazabilidad["eventos"]]
        self.assertEqual(nombres_eventos, ["PREPARADO", "PRECINTADO", "EN_TRANSITO", "RECIBIDO", "VERIFICADO"])

    def test_no_se_puede_cerrar_remito_con_bulto_sin_verificar(self) -> None:
        orden = self.reposicion_service.crear_orden_manual("CD-CENTRAL", "LOCAL-01", [{"producto_id": "P1", "cantidad": 5}])
        bulto = self.empaquetado_service.crear_bulto(orden.id, [{"producto_id": "P1", "cantidad": 5}])
        self.empaquetado_service.registrar_precinto("PREC-X")
        self.empaquetado_service.precintar_bulto(bulto.id, "PREC-X")
        self.empaquetado_service.generar_remito("REM-901", orden.id, [bulto.id])
        self.despacho_service.despachar_remito("REM-901")
        self.recepcion_service.recibir_remito("REM-901")

        # Intentar cerrar sin haber verificado el bulto
        with self.assertRaises(Remito_Incompleto_Exception):
            self.recepcion_service.cerrar_remito("REM-901")

    def test_no_se_puede_exceder_cantidad_solicitada_en_orden(self) -> None:
        orden = self.reposicion_service.crear_orden_manual("CD-CENTRAL", "LOCAL-01", [{"producto_id": "P1", "cantidad": 5}])
        with self.assertRaises(Orden_Invalida_Exception):
            self.empaquetado_service.crear_bulto(orden.id, [{"producto_id": "P1", "cantidad": 10}])

    def test_no_se_puede_reutilizar_precinto(self) -> None:
        orden = self.reposicion_service.crear_orden_manual("CD-CENTRAL", "LOCAL-01", [{"producto_id": "P1", "cantidad": 5}])
        bulto1 = self.empaquetado_service.crear_bulto(orden.id, [{"producto_id": "P1", "cantidad": 2}])
        bulto2 = self.empaquetado_service.crear_bulto(orden.id, [{"producto_id": "P1", "cantidad": 2}])

        self.empaquetado_service.registrar_precinto("PREC-UNICO")
        self.empaquetado_service.precintar_bulto(bulto1.id, "PREC-UNICO")

        # Intentar usar el mismo precinto en otro bulto debe fallar
        with self.assertRaises(Precinto_Invalido_Exception):
            self.empaquetado_service.precintar_bulto(bulto2.id, "PREC-UNICO")


if __name__ == "__main__":
    unittest.main()
