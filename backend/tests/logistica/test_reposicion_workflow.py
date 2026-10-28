"""Suite de pruebas de flujo de reposicion, consolidacion y trazabilidad (US3 / T040).

Prueba:
- Creacion de orden manual valida y consolidacion de necesidades para un mismo destino.
- Rechazo atomico ante destinos mixtos, origen no CD, destino no local, duplicados y cantidades <= 0.
- Registro de trazabilidad inmutable y rollback transaccional ante excepciones.
"""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.logistica.application.reposicion_service import Reposicion_Service
from modules.logistica.application.trazabilidad_service import Trazabilidad_Service
from modules.logistica.domain.exceptions import (
    Orden_Invalida_Exception,
    Orden_No_Encontrada_Exception,
)
from modules.logistica.infrastructure.necesidad_reposicion_repository import (
    Necesidad_Reposicion_Repository,
)
from modules.logistica.infrastructure.orden_reposicion_repository import (
    Orden_Reposicion_Repository,
)
from modules.logistica.infrastructure.stock_logistica_adapter import Stock_Logistica_Adapter
from modules.logistica.infrastructure.trazabilidad_repository import Trazabilidad_Repository
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Ubicacion_No_Encontrada_Exception,
    Stock_Insuficiente_Exception,
)
from sqlite_logistica_test_case import (
    CD_ID,
    LOCAL_ID,
    OTRO_LOCAL_ID,
    PRODUCTO_A,
    PRODUCTO_B,
    PRODUCTO_INACTIVO,
    Sqlite_Test_Case,
)


class TestReposicionWorkflow(Sqlite_Test_Case):
    """Pruebas de integración del flujo de reposición (T037, T039, T040)."""

    def setUp(self) -> None:
        super().setUp()
        self.cargar_datos_integrante_1({PRODUCTO_A: 50, PRODUCTO_B: 20})
        self.adapter = Stock_Logistica_Adapter()
        self.necesidad_repo = Necesidad_Reposicion_Repository()
        self.orden_repo = Orden_Reposicion_Repository()
        self.trazabilidad_repo = Trazabilidad_Repository()
        self.trazabilidad_service = Trazabilidad_Service(
            trazabilidad_repository=self.trazabilidad_repo,
            orden_repository=self.orden_repo,
        )
        self.reposicion_service = Reposicion_Service(
            stock_service=self.adapter,
            orden_repository=self.orden_repo,
            necesidad_repository=self.necesidad_repo,
            trazabilidad_service=self.trazabilidad_service,
        )

    # -------------------------------------------------------------------------
    # 1. Creación de orden manual válida
    # -------------------------------------------------------------------------

    def test_creacion_orden_manual_valida(self) -> None:
        """Crea una orden manual válida con múltiples renglones y verifica persistencia."""
        items = [
            {"producto_id": PRODUCTO_A, "cantidad": 10},
            {"producto_id": PRODUCTO_B, "cantidad": 5},
        ]
        orden = self.reposicion_service.crear_orden_manual(
            origen_id=CD_ID,
            destino_id=LOCAL_ID,
            items=items,
            actor="admin@stocky.local",
        )

        self.assertIsNotNone(orden.id)
        self.assertEqual(orden.origen_id, CD_ID)
        self.assertEqual(orden.destino_id, LOCAL_ID)
        self.assertEqual(orden.estado, "PENDIENTE")
        self.assertEqual(len(orden.detalles), 2)

        # Verificar recuperación desde repositorio
        recuperada = self.orden_repo.obtener_por_id(orden.id)
        self.assertIsNotNone(recuperada)
        self.assertEqual(recuperada.estado, "PENDIENTE")

        # Verificar evento de trazabilidad inmutable registrado
        eventos = self.trazabilidad_repo.listar_por_entidad("ORDEN", orden.id)
        self.assertEqual(len(eventos), 1)
        ev = eventos[0]
        self.assertEqual(ev.tipo_entidad, "ORDEN")
        self.assertEqual(ev.entidad_id, orden.id)
        self.assertEqual(ev.accion, "CREAR_ORDEN")
        self.assertEqual(ev.estado_nuevo, "PENDIENTE")
        self.assertEqual(ev.actor, "admin@stocky.local")
        self.assertEqual(ev.origen_id, CD_ID)
        self.assertEqual(ev.destino_id, LOCAL_ID)
        self.assertIsNotNone(ev.fecha_hora)

    # -------------------------------------------------------------------------
    # 2. Consolidación de necesidades de un mismo destino
    # -------------------------------------------------------------------------

    def test_consolidacion_necesidades_mismo_destino(self) -> None:
        """Consolida necesidades pendientes de un destino en una orden única."""
        n1 = self.reposicion_service.registrar_necesidad(PRODUCTO_A, LOCAL_ID, 15)
        n2 = self.reposicion_service.registrar_necesidad(PRODUCTO_B, LOCAL_ID, 8)
        self.assertIsNotNone(n1)
        self.assertIsNotNone(n2)

        orden = self.reposicion_service.consolidar_necesidades_en_orden(
            local_destino_id=LOCAL_ID,
            origen_id=CD_ID,
            necesidad_ids=[n1, n2],
            actor="operador_cd",
        )

        self.assertIsNotNone(orden.id)
        self.assertEqual(orden.origen_id, CD_ID)
        self.assertEqual(orden.destino_id, LOCAL_ID)
        self.assertEqual(orden.estado, "PENDIENTE")

        # Las necesidades quedan en estado CONSOLIDADA vinculadas a la orden
        nec1 = self.necesidad_repo.obtener_por_id(n1)
        nec2 = self.necesidad_repo.obtener_por_id(n2)
        self.assertEqual(nec1["estado"], "CONSOLIDADA")
        self.assertEqual(nec1["orden_id"], orden.id)
        self.assertEqual(nec2["estado"], "CONSOLIDADA")
        self.assertEqual(nec2["orden_id"], orden.id)

        # Trazabilidad vincula las necesidades consolidadas
        eventos = self.trazabilidad_repo.listar_por_entidad("ORDEN", orden.id)
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].accion, "CONSOLIDAR_ORDEN")
        self.assertIn(f"{n1}", eventos[0].registros_asociados)
        self.assertIn(f"{n2}", eventos[0].registros_asociados)

    def test_consolidacion_automatica_sin_especificar_ids(self) -> None:
        """Consolida todas las necesidades pendientes del destino cuando necesidad_ids es None."""
        n1 = self.reposicion_service.registrar_necesidad(PRODUCTO_A, LOCAL_ID, 12)
        orden = self.reposicion_service.consolidar_necesidades_en_orden(
            local_destino_id=LOCAL_ID,
            origen_id=CD_ID,
        )
        self.assertEqual(len(orden.detalles), 1)
        nec = self.necesidad_repo.obtener_por_id(n1)
        self.assertEqual(nec["estado"], "CONSOLIDADA")

    # -------------------------------------------------------------------------
    # 3. Rechazo atómico de destinos mixtos y consolidación ambigua
    # -------------------------------------------------------------------------

    def test_rechazo_destinos_mixtos_en_consolidacion(self) -> None:
        """Rechaza atómicamente si se intentan consolidar necesidades de distintos locales."""
        n_local_1 = self.reposicion_service.registrar_necesidad(PRODUCTO_A, LOCAL_ID, 10)
        n_local_2 = self.reposicion_service.registrar_necesidad(PRODUCTO_A, OTRO_LOCAL_ID, 5)

        with self.assertRaises(Orden_Invalida_Exception) as ctx:
            self.reposicion_service.consolidar_necesidades_en_orden(
                local_destino_id=LOCAL_ID,
                origen_id=CD_ID,
                necesidad_ids=[n_local_1, n_local_2],
            )
        self.assertIn("distintos destinos", str(ctx.exception))

        # Ambas necesidades permanecen PENDIENTES
        self.assertEqual(self.necesidad_repo.obtener_por_id(n_local_1)["estado"], "PENDIENTE")
        self.assertEqual(self.necesidad_repo.obtener_por_id(n_local_2)["estado"], "PENDIENTE")

    def test_rechazo_consolidacion_ambigua_ids_duplicados_o_inexistentes(self) -> None:
        """Rechaza consolidación si los IDs están duplicados, vacíos o no existen."""
        n1 = self.reposicion_service.registrar_necesidad(PRODUCTO_A, LOCAL_ID, 10)

        # IDs duplicados
        with self.assertRaises(Orden_Invalida_Exception):
            self.reposicion_service.consolidar_necesidades_en_orden(
                local_destino_id=LOCAL_ID,
                origen_id=CD_ID,
                necesidad_ids=[n1, n1],
            )

        # Lista vacía
        with self.assertRaises(Orden_Invalida_Exception):
            self.reposicion_service.consolidar_necesidades_en_orden(
                local_destino_id=LOCAL_ID,
                origen_id=CD_ID,
                necesidad_ids=[],
            )

        # ID inexistente
        with self.assertRaises(Orden_Invalida_Exception):
            self.reposicion_service.consolidar_necesidades_en_orden(
                local_destino_id=LOCAL_ID,
                origen_id=CD_ID,
                necesidad_ids=[99999],
            )

    def test_rechazo_necesidad_ya_consolidada(self) -> None:
        """Rechaza consolidar una necesidad que ya fue consolidada previamente."""
        n1 = self.reposicion_service.registrar_necesidad(PRODUCTO_A, LOCAL_ID, 5)
        self.reposicion_service.consolidar_necesidades_en_orden(
            local_destino_id=LOCAL_ID,
            origen_id=CD_ID,
            necesidad_ids=[n1],
        )

        with self.assertRaises(Orden_Invalida_Exception):
            self.reposicion_service.consolidar_necesidades_en_orden(
                local_destino_id=LOCAL_ID,
                origen_id=CD_ID,
                necesidad_ids=[n1],
            )

    # -------------------------------------------------------------------------
    # 4. Rechazo de origen / destino inválidos
    # -------------------------------------------------------------------------

    def test_rechazo_origen_no_es_cd(self) -> None:
        """El origen debe ser un Centro de Distribución activo; un Local como origen es rechazado."""
        items = [{"producto_id": PRODUCTO_A, "cantidad": 5}]

        # Origen es un local en vez de un CD
        with self.assertRaises(Ubicacion_No_Encontrada_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=LOCAL_ID,
                destino_id=OTRO_LOCAL_ID,
                items=items,
            )

        # Origen inexistente
        with self.assertRaises(Ubicacion_No_Encontrada_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=999,
                destino_id=LOCAL_ID,
                items=items,
            )

    def test_rechazo_destino_no_es_local(self) -> None:
        """El destino debe ser un Local activo; un CD como destino o destino inexistente es rechazado."""
        items = [{"producto_id": PRODUCTO_A, "cantidad": 5}]

        # Destino igual a origen es rechazado
        with self.assertRaises(Orden_Invalida_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=CD_ID,
                destino_id=CD_ID,
                items=items,
            )

        # Destino es un local inactivo
        from sqlalchemy import text
        self.session.execute(
            text("INSERT INTO ubicaciones (id, tipo, nombre, direccion, activo) VALUES (4, 'LOCAL', 'Local Cerrado', 'Av 1', 0)")
        )
        self.session.flush()

        with self.assertRaises(Ubicacion_No_Encontrada_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=CD_ID,
                destino_id=4,
                items=items,
            )

        # Destino inexistente
        with self.assertRaises(Ubicacion_No_Encontrada_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=CD_ID,
                destino_id=999,
                items=items,
            )

    # -------------------------------------------------------------------------
    # 5. Rechazo de productos duplicados y cantidades inválidas
    # -------------------------------------------------------------------------

    def test_rechazo_productos_duplicados_en_items(self) -> None:
        """Rechaza atómicamente la orden si se repiten productos en los renglones."""
        items = [
            {"producto_id": PRODUCTO_A, "cantidad": 5},
            {"producto_id": PRODUCTO_A, "cantidad": 3},
        ]
        with self.assertRaises(Orden_Invalida_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=CD_ID,
                destino_id=LOCAL_ID,
                items=items,
            )

    def test_rechazo_cantidades_menores_o_iguales_a_cero(self) -> None:
        """Rechaza renglones con cantidad cero o negativa."""
        for cant in (0, -1, -50):
            with self.subTest(cantidad=cant), self.assertRaises(Orden_Invalida_Exception):
                self.reposicion_service.crear_orden_manual(
                    origen_id=CD_ID,
                    destino_id=LOCAL_ID,
                    items=[{"producto_id": PRODUCTO_A, "cantidad": cant}],
                )

    def test_rechazo_producto_inactivo_o_inexistente(self) -> None:
        """Rechaza productos que no existen o están inactivos en el catálogo."""
        with self.assertRaises(Producto_No_Encontrado_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=CD_ID,
                destino_id=LOCAL_ID,
                items=[{"producto_id": PRODUCTO_INACTIVO, "cantidad": 5}],
            )

        with self.assertRaises(Producto_No_Encontrado_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=CD_ID,
                destino_id=LOCAL_ID,
                items=[{"producto_id": 9999, "cantidad": 5}],
            )

    # -------------------------------------------------------------------------
    # 6. Validación de stock en CD si aplica
    # -------------------------------------------------------------------------

    def test_validacion_stock_en_cd_si_aplica(self) -> None:
        """Cuando validar_stock es True, rechaza si el CD no tiene suficiente stock disponible."""
        # PRODUCTO_A tiene 50 en el CD
        items_excedentes = [{"producto_id": PRODUCTO_A, "cantidad": 51}]
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.reposicion_service.crear_orden_manual(
                origen_id=CD_ID,
                destino_id=LOCAL_ID,
                items=items_excedentes,
                validar_stock=True,
            )

        # Con cantidad menor o igual a 50, se crea exitosamente
        orden = self.reposicion_service.crear_orden_manual(
            origen_id=CD_ID,
            destino_id=LOCAL_ID,
            items=[{"producto_id": PRODUCTO_A, "cantidad": 50}],
            validar_stock=True,
        )
        self.assertIsNotNone(orden.id)

    # -------------------------------------------------------------------------
    # 7. Consultas de trazabilidad de orden y línea de tiempo
    # -------------------------------------------------------------------------

    def test_consulta_resumen_trazabilidad_orden(self) -> None:
        """Consulta el resumen de trazabilidad de una orden existente e inexistente."""
        orden = self.reposicion_service.crear_orden_manual(
            origen_id=CD_ID,
            destino_id=LOCAL_ID,
            items=[{"producto_id": PRODUCTO_A, "cantidad": 5}],
            actor="admin@stocky.local",
        )

        resumen = self.trazabilidad_service.consultar_resumen_orden(orden.id)
        self.assertEqual(resumen["orden_id"], orden.id)
        self.assertEqual(resumen["origen_id"], CD_ID)
        self.assertEqual(resumen["destino_id"], LOCAL_ID)
        self.assertEqual(resumen["estado_actual"], "PENDIENTE")
        self.assertEqual(len(resumen["eventos"]), 1)
        self.assertEqual(resumen["eventos"][0]["actor"], "admin@stocky.local")

        with self.assertRaises(Orden_No_Encontrada_Exception):
            self.trazabilidad_service.consultar_resumen_orden(9999)

    # -------------------------------------------------------------------------
    # 8. Rollback transaccional ante excepciones
    # -------------------------------------------------------------------------

    def test_rollback_atomico_ante_error_en_creacion(self) -> None:
        """Verifica que una falla en la transacción no deja órdenes ni trazabilidad huérfana."""
        n1 = self.reposicion_service.registrar_necesidad(PRODUCTO_A, LOCAL_ID, 5)
        total_ordenes_previas = len(self.orden_repo.listar_todas())
        total_eventos_previos = len(self.trazabilidad_repo.listar_todos())

        # Intentar consolidación con destino mixto provoca excepción
        n_otro = self.reposicion_service.registrar_necesidad(PRODUCTO_A, OTRO_LOCAL_ID, 3)
        with self.assertRaises(Orden_Invalida_Exception):
            self.reposicion_service.consolidar_necesidades_en_orden(
                local_destino_id=LOCAL_ID,
                origen_id=CD_ID,
                necesidad_ids=[n1, n_otro],
            )

        # No se crearon órdenes ni eventos huérfanos
        self.assertEqual(len(self.orden_repo.listar_todas()), total_ordenes_previas)
        self.assertEqual(len(self.trazabilidad_repo.listar_todos()), total_eventos_previos)
        self.assertEqual(self.necesidad_repo.obtener_por_id(n1)["estado"], "PENDIENTE")


if __name__ == "__main__":
    unittest.main()
