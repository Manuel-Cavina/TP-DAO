from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.estado_bulto import Estado_Precintado, Estado_Verificado
from modules.logistica.domain.exceptions import (
    Bulto_No_Encontrado_Exception,
    Orden_No_Encontrada_Exception,
    Precinto_Duplicado_Exception,
    Remito_Duplicado_Exception,
)
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.domain.precinto import Precinto
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure import (
    Bulto_Repository,
    Historial_Bulto_Repository,
    Necesidad_Reposicion_Repository,
    Orden_Reposicion_Repository,
    Precinto_Repository,
    Remito_Repository,
)
from sqlite_logistica_test_case import CD_ID, LOCAL_ID, Sqlite_Test_Case


class TestLogisticaPersistence(Sqlite_Test_Case):
    """Repositorios ORM de logistica: la sesion sale solo de Request_Session_Context."""

    def setUp(self) -> None:
        super().setUp()
        self.precinto_repo = Precinto_Repository()
        self.historial_repo = Historial_Bulto_Repository()
        self.bulto_repo = Bulto_Repository()
        self.orden_repo = Orden_Reposicion_Repository()
        self.remito_repo = Remito_Repository(bulto_repository=self.bulto_repo)
        self.necesidad_repo = Necesidad_Reposicion_Repository()

    def test_precinto_crud(self) -> None:
        precinto = Precinto(codigo="PREC-100", esta_intacto=True)
        self.precinto_repo.guardar(precinto)

        self.assertTrue(self.precinto_repo.esta_disponible("PREC-100"))

        self.precinto_repo.marcar_utilizado("PREC-100")
        self.assertFalse(self.precinto_repo.esta_disponible("PREC-100"))

        precinto_recuperado = self.precinto_repo.obtener_por_codigo("PREC-100")
        self.assertIsNotNone(precinto_recuperado)
        self.assertEqual(precinto_recuperado.codigo, "PREC-100")

    def test_orden_reposicion_persistencia(self) -> None:
        orden = Orden_Reposicion(
            origen_id=CD_ID,
            destino_id=LOCAL_ID,
            detalles=[
                Detalle_Orden_Reposicion(1, 20),
                Detalle_Orden_Reposicion(2, 15),
            ],
        )
        self.orden_repo.guardar(orden)
        self.assertIsNotNone(orden.id)

        recuperada = self.orden_repo.obtener_por_id(orden.id)
        self.assertIsNotNone(recuperada)
        self.assertEqual(recuperada.origen_id, CD_ID)
        self.assertEqual(recuperada.destino_id, LOCAL_ID)
        self.assertEqual(len(recuperada.detalles), 2)
        self.assertEqual(recuperada.detalles[0].cantidad_solicitada, 20)

        # Actualizar estado y envios
        recuperada.iniciar_preparacion()
        recuperada.detalles[0].registrar_envio(10)
        self.orden_repo.actualizar(recuperada)

        actualizada = self.orden_repo.obtener_por_id(orden.id)
        self.assertEqual(actualizada.estado, "EN_PREPARACION")
        self.assertEqual(actualizada.detalles[0].cantidad_enviada, 10)

    def test_bulto_persistencia_con_transiciones_e_historial(self) -> None:
        # 1. Crear y guardar orden base
        orden = Orden_Reposicion(origen_id=CD_ID, destino_id=LOCAL_ID)
        self.orden_repo.guardar(orden)

        # 2. Precinto
        precinto = Precinto("PREC-555")
        self.precinto_repo.guardar(precinto)

        # 3. Bulto con contenido
        bulto = Bulto(
            orden_id=orden.id,
            detalles=[Detalle_Bulto(1, 5), Detalle_Bulto(2, 3)],
        )
        self.bulto_repo.guardar(bulto)
        self.assertIsNotNone(bulto.id)

        # 4. Transicion a Precintado y actualizacion
        bulto.precintar(precinto)
        self.bulto_repo.actualizar(bulto)

        recuperado = self.bulto_repo.obtener_por_id(bulto.id)
        self.assertIsNotNone(recuperado)
        self.assertIsInstance(recuperado.estado, Estado_Precintado)
        self.assertIsNotNone(recuperado.precinto)
        self.assertEqual(recuperado.precinto.codigo, "PREC-555")
        self.assertEqual(len(recuperado.detalles), 2)

        # 5. Completar ciclo hasta Verificado
        recuperado.despachar()
        recuperado.recibir()
        recuperado.verificar("PREC-555", esta_intacto=True)
        self.bulto_repo.actualizar(recuperado)

        final = self.bulto_repo.obtener_por_id(bulto.id)
        self.assertIsInstance(final.estado, Estado_Verificado)
        self.assertEqual(
            [h.estado_nuevo for h in final.historial],
            ["PREPARADO", "PRECINTADO", "EN_TRANSITO", "RECIBIDO", "VERIFICADO"],
        )

    def test_remito_persistencia_con_bultos(self) -> None:
        orden = Orden_Reposicion(origen_id=CD_ID, destino_id=LOCAL_ID)
        self.orden_repo.guardar(orden)

        precinto = Precinto("PREC-999")
        self.precinto_repo.guardar(precinto)

        bulto = Bulto(orden_id=orden.id, detalles=[Detalle_Bulto(1, 10)])
        bulto.precintar(precinto)
        self.bulto_repo.guardar(bulto)

        remito = Remito(
            numero="REM-1001",
            origen_id=CD_ID,
            destino_id=LOCAL_ID,
            bultos=[bulto],
        )
        self.remito_repo.guardar(remito)

        recuperado = self.remito_repo.obtener_por_numero("REM-1001")
        self.assertIsNotNone(recuperado)
        self.assertEqual(recuperado.numero, "REM-1001")
        self.assertEqual(len(recuperado.bultos), 1)
        self.assertEqual(recuperado.bultos[0].id, bulto.id)

    def test_necesidades_reposicion_no_duplica(self) -> None:
        id1 = self.necesidad_repo.registrar(1, LOCAL_ID, 10)
        self.assertIsNotNone(id1)

        id2 = self.necesidad_repo.registrar(1, LOCAL_ID, 5)
        self.assertIsNone(id2)

        pendientes = self.necesidad_repo.listar_pendientes(LOCAL_ID)
        self.assertEqual(len(pendientes), 1)

        orden = self.orden_repo.guardar(Orden_Reposicion(CD_ID, LOCAL_ID, detalles=[Detalle_Orden_Reposicion(1, 10)]))
        self.necesidad_repo.consolidar_en_orden([id1], orden.id)
        pendientes_despues = self.necesidad_repo.listar_pendientes(LOCAL_ID)
        self.assertEqual(len(pendientes_despues), 0)

    def test_remito_estado_existe_y_bulto_asignado(self) -> None:
        orden = self.orden_repo.guardar(Orden_Reposicion(CD_ID, LOCAL_ID))
        self.precinto_repo.guardar(Precinto("PREC-1"))
        bulto = Bulto(orden_id=orden.id, detalles=[Detalle_Bulto(1, 1)])
        bulto.precintar(Precinto("PREC-1"))
        self.bulto_repo.guardar(bulto)
        self.assertIsNone(self.bulto_repo.remito_asignado(bulto.id))

        self.remito_repo.guardar(Remito("REM-1", CD_ID, LOCAL_ID, bultos=[bulto]))

        self.assertTrue(self.remito_repo.existe("REM-1"))
        self.assertEqual(self.remito_repo.estado("REM-1"), "EMITIDO")
        self.assertIsNone(self.remito_repo.estado("NO-EXISTE"))
        self.assertEqual(self.bulto_repo.remito_asignado(bulto.id), "REM-1")

    def test_clave_duplicada_se_traduce_a_excepcion_de_negocio(self) -> None:
        """Si dos peticiones pasan el chequeo previo a la vez, la PK lo detecta y da 409, no 500."""
        self.precinto_repo.guardar(Precinto("PREC-D"))
        with self.assertRaises(Precinto_Duplicado_Exception):
            self.precinto_repo.guardar(Precinto("PREC-D"))
        self.session.rollback()

        self.remito_repo.guardar(Remito("REM-D", CD_ID, LOCAL_ID))
        with self.assertRaises(Remito_Duplicado_Exception):
            self.remito_repo.guardar(Remito("REM-D", CD_ID, LOCAL_ID))

    def test_precinto_roto_se_persiste(self) -> None:
        precinto = Precinto("PREC-ROTO")
        self.precinto_repo.guardar(precinto)
        precinto.romper()
        self.precinto_repo.actualizar(precinto)

        self.assertFalse(self.precinto_repo.obtener_por_codigo("PREC-ROTO").esta_intacto)

    def test_actualizar_inexistente_lanza_error_tipado(self) -> None:
        with self.assertRaises(Bulto_No_Encontrado_Exception):
            self.bulto_repo.actualizar(Bulto(orden_id=1, id=999))
        with self.assertRaises(Orden_No_Encontrada_Exception):
            self.orden_repo.actualizar(Orden_Reposicion(CD_ID, LOCAL_ID, id=999))


if __name__ == "__main__":
    unittest.main()
