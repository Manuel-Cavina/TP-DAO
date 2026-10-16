from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from config.database.base import Base
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.detalle_orden_reposicion import Detalle_Orden_Reposicion
from modules.logistica.domain.estado_bulto import Estado_Precintado, Estado_Verificado
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


class TestLogisticaPersistence(unittest.TestCase):
    """Pruebas de persistencia e infraestructura SQLAlchemy ORM para el modulo de logistica."""

    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine)
        self.session: Session = self.session_factory()

        self.precinto_repo = Precinto_Repository(session=self.session)
        self.historial_repo = Historial_Bulto_Repository(session=self.session)
        self.bulto_repo = Bulto_Repository(session=self.session)
        self.orden_repo = Orden_Reposicion_Repository(session=self.session)
        self.remito_repo = Remito_Repository(bulto_repository=self.bulto_repo, session=self.session)
        self.necesidad_repo = Necesidad_Reposicion_Repository(session=self.session)

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

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
            origen_id="CD-CENTRAL",
            destino_id="LOCAL-NORTE",
            detalles=[
                Detalle_Orden_Reposicion("PROD-01", 20),
                Detalle_Orden_Reposicion("PROD-02", 15),
            ],
        )
        self.orden_repo.guardar(orden)
        self.assertIsNotNone(orden.id)

        recuperada = self.orden_repo.obtener_por_id(orden.id)
        self.assertIsNotNone(recuperada)
        self.assertEqual(recuperada.origen_id, "CD-CENTRAL")
        self.assertEqual(recuperada.destino_id, "LOCAL-NORTE")
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
        orden = Orden_Reposicion(origen_id="CD-CENTRAL", destino_id="LOCAL-01")
        self.orden_repo.guardar(orden)

        # 2. Precinto
        precinto = Precinto("PREC-555")
        self.precinto_repo.guardar(precinto)

        # 3. Bulto con contenido
        bulto = Bulto(
            orden_id=orden.id,
            detalles=[Detalle_Bulto("PROD-01", 5), Detalle_Bulto("PROD-02", 3)],
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
        orden = Orden_Reposicion(origen_id="CD-CENTRAL", destino_id="LOCAL-01")
        self.orden_repo.guardar(orden)

        precinto = Precinto("PREC-999")
        self.precinto_repo.guardar(precinto)

        bulto = Bulto(orden_id=orden.id, detalles=[Detalle_Bulto("PROD-01", 10)])
        bulto.precintar(precinto)
        self.bulto_repo.guardar(bulto)

        remito = Remito(
            numero="REM-1001",
            origen_id="CD-CENTRAL",
            destino_id="LOCAL-01",
            bultos=[bulto],
        )
        self.remito_repo.guardar(remito)

        recuperado = self.remito_repo.obtener_por_numero("REM-1001")
        self.assertIsNotNone(recuperado)
        self.assertEqual(recuperado.numero, "REM-1001")
        self.assertEqual(len(recuperado.bultos), 1)
        self.assertEqual(recuperado.bultos[0].id, bulto.id)

    def test_necesidades_reposicion_no_duplica(self) -> None:
        id1 = self.necesidad_repo.registrar("PROD-01", "LOCAL-01", 10)
        self.assertIsNotNone(id1)

        id2 = self.necesidad_repo.registrar("PROD-01", "LOCAL-01", 5)
        self.assertIsNone(id2)

        pendientes = self.necesidad_repo.listar_pendientes("LOCAL-01")
        self.assertEqual(len(pendientes), 1)

        self.necesidad_repo.consolidar_en_orden([id1], 100)
        pendientes_despues = self.necesidad_repo.listar_pendientes("LOCAL-01")
        self.assertEqual(len(pendientes_despues), 0)


if __name__ == "__main__":
    unittest.main()
